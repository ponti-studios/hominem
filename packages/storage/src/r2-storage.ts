import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  buildStoredFileName,
  formatTimestampForFileName,
  getExtensionFromMimeType,
  getFileExtension,
  sanitizeFileName,
} from '@hominem/utils/files';

import { StorageServiceError } from './errors';
import type { FileObject, PreparedUpload, StorageOptions, StoredFile } from './types';
import { isSupportedUploadMimeType } from './upload-policy';

export type StorageCategory = 'csvs' | 'chats' | 'places' | 'images' | 'documents';

function resolveFileExtension(filename: string, mimetype: string): string {
  const ext = getFileExtension(filename);
  return ext ? `.${ext}` : getExtensionFromMimeType(mimetype);
}

function getIsTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

type StorageConnectionConfig = {
  endpoint: string;
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicUrl?: string;
  forcePathStyle: boolean;
  canCreateBucket: boolean;
};

const localMinioStorageConfig: StorageConnectionConfig = {
  endpoint: 'http://localhost:9000',
  region: 'auto',
  bucketName: 'storage',
  accessKeyId: 'minioadmin',
  secretAccessKey: 'minioadmin',
  publicUrl: 'http://localhost:9000',
  forcePathStyle: true,
  canCreateBucket: true,
};

function getCloudflareR2StorageConfig(): StorageConnectionConfig | null {
  const endpoint = process.env.R2_ENDPOINT;
  const bucketName = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const publicUrl = process.env.R2_PUBLIC_URL;
  const values = [endpoint, bucketName, accessKeyId, secretAccessKey, publicUrl];
  const hasPartialConfig = values.some(Boolean);

  if (!hasPartialConfig) {
    return null;
  }

  const missing = [
    endpoint ? null : 'R2_ENDPOINT',
    bucketName ? null : 'R2_BUCKET_NAME',
    accessKeyId ? null : 'R2_ACCESS_KEY_ID',
    secretAccessKey ? null : 'R2_SECRET_ACCESS_KEY',
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    throw new StorageServiceError('storage.config.missing', { missing });
  }

  return {
    endpoint: endpoint!,
    region: 'auto',
    bucketName: bucketName!,
    accessKeyId: accessKeyId!,
    secretAccessKey: secretAccessKey!,
    publicUrl,
    forcePathStyle: false,
    canCreateBucket: false,
  };
}

function getStorageConnectionConfig(): StorageConnectionConfig {
  const r2Config = getCloudflareR2StorageConfig();
  if (r2Config) {
    return r2Config;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new StorageServiceError('storage.config.missing', {
      missing: ['R2_ENDPOINT', 'R2_BUCKET_NAME', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    });
  }

  return localMinioStorageConfig;
}

function getBucketAccessError(bucketName: string, error: unknown): StorageServiceError {
  if (!(error instanceof Error)) {
    return new StorageServiceError('storage.bucket.access_unknown', {
      bucketName,
      causeType: typeof error,
    });
  }

  const errorMessage = error.message.toLowerCase();

  if (
    errorMessage.includes('credential access key has length') ||
    errorMessage.includes('signature') ||
    errorMessage.includes('invalidaccesskeyid') ||
    errorMessage.includes('authorizationheadermalformed')
  ) {
    return new StorageServiceError('storage.credentials.invalid', {
      bucketName,
      reason: error.message,
    });
  }

  if (
    errorMessage.includes('access denied') ||
    errorMessage.includes('unauthorized') ||
    errorMessage.includes('forbidden')
  ) {
    return new StorageServiceError('storage.bucket.access_denied', {
      bucketName,
      reason: error.message,
    });
  }

  if (errorMessage.includes('no such bucket') || errorMessage.includes('not found')) {
    return new StorageServiceError('storage.bucket.missing', {
      bucketName,
      reason: error.message,
    });
  }

  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('network')
  ) {
    return new StorageServiceError('storage.network.unreachable', {
      bucketName,
      reason: error.message,
    });
  }

  return new StorageServiceError('storage.bucket.access_unknown', {
    bucketName,
    reason: error.message,
    name: error.name,
  });
}

class InMemoryStorageBackend {
  client?: S3Client;
  bucketName = 'app-test';
  isPublic = false;
  userScoped = true;
  canCreateBucket = false;
  files: Map<string, Buffer> = new Map();
  maxFileSize: number;
  category: StorageCategory;
  pendingUploads: Map<string, { buffer?: Buffer; mimetype: string; size: number }> = new Map();
  preparedUploadKeys: Map<string, { key: string; userId: string }> = new Map();

  constructor(category: StorageCategory, options?: StorageOptions) {
    this.category = category;
    this.maxFileSize = options?.maxFileSize || 50 * 1024 * 1024;
    void options?.isPublic; // Note: isPublic is handled by subclass implementations
  }

  /**
   * Test-only method to store a file with an exact key.
   * Only available in test mode.
   */
  async __testOnlyStoreFile(filePath: string, buffer: Buffer): Promise<void> {
    if (!getIsTestMode()) {
      throw new Error('__testOnlyStoreFile is only available in test mode');
    }
    this.files.set(filePath, buffer);
    this.pendingUploads.delete(filePath);
  }

  /** @deprecated Use __testOnlyStoreFile instead */
  async storeFileWithExactKey(filePath: string, buffer: Buffer): Promise<void> {
    await this.__testOnlyStoreFile(filePath, buffer);
  }

  markUploadPending(filePath: string, mimetype: string, size: number): void {
    this.pendingUploads.set(filePath, { mimetype, size });
  }

  markPreparedUpload(fileId: string, key: string, userId: string): void {
    this.preparedUploadKeys.set(fileId, { key, userId });
  }

  getPreparedUploadInfo(fileId: string): { key: string; userId: string } | undefined {
    return this.preparedUploadKeys.get(fileId);
  }

  completePendingUpload(filePath: string, buffer: Buffer): void {
    this.files.set(filePath, buffer);
    this.pendingUploads.delete(filePath);
  }

  getKey(userId: string, filename: string): string {
    return `users/${userId}/${this.category}/${filename}`;
  }

  createStoredName(id: string, filename: string, extension: string): string {
    return buildStoredFileName(id, filename, extension);
  }

  isValidFileType(mimetype: string): boolean {
    return isSupportedUploadMimeType(mimetype);
  }

  async ensureBucket(): Promise<void> {
    // No-op for in-memory backend
  }

  async createPreparedUpload(
    input: {
      originalName: string;
      mimetype: string;
      size: number;
      filename?: string;
    },
    userId: string,
    expiresIn = 900,
  ): Promise<PreparedUpload> {
    if (input.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }

    if (!this.isValidFileType(input.mimetype)) {
      throw new Error(`Unsupported file type: ${input.mimetype}`);
    }

    const id = crypto.randomUUID();
    const originalName = input.originalName || input.filename || 'file';
    const extension = resolveFileExtension(originalName, input.mimetype);
    const storedName = input.filename
      ? this.createStoredName(id, input.filename, extension)
      : `${id}${extension}`;
    const key = this.getKey(userId, storedName);

    this.markPreparedUpload(id, key, userId);

    return {
      id,
      key,
      originalName,
      mimetype: input.mimetype,
      size: input.size,
      uploadUrl: `http://localhost:4040/api/files/upload-bytes/${id}`,
      headers: {
        'content-type': input.mimetype,
      },
      url: `http://localhost:4040/files/${id}`,
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async storeFile(
    buffer: Buffer,
    mimetype: string,
    userId: string,
    options?: {
      filename?: string;
      originalName?: string;
    },
  ): Promise<StoredFile> {
    if (buffer.byteLength > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }

    const originalName = options?.originalName || options?.filename || 'file';
    const preparedUpload = await this.createPreparedUpload(
      {
        originalName,
        mimetype,
        size: buffer.byteLength,
        ...(options?.filename ? { filename: options.filename } : {}),
      },
      userId,
      3600,
    );

    this.files.set(preparedUpload.key, buffer);
    this.pendingUploads.delete(preparedUpload.key);

    return {
      id: preparedUpload.id,
      originalName: preparedUpload.originalName,
      filename: preparedUpload.key,
      mimetype,
      size: buffer.byteLength,
      url: preparedUpload.url,
      uploadedAt: preparedUpload.uploadedAt,
    };
  }

  async getFile(fileId: string, userId: string): Promise<ArrayBuffer | null> {
    const files = await this.listUserFiles(userId);
    const file = files.find((f) => f.name.startsWith(fileId));

    if (!file) {
      return null;
    }

    const key = this.getKey(userId, file.name);
    const buffer = this.files.get(key);
    return buffer
      ? (buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        ) as ArrayBuffer)
      : null;
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    const files = await this.listUserFiles(userId);
    const file = files.find((f) => f.name.startsWith(fileId));

    if (!file) {
      return false;
    }

    const key = this.getKey(userId, file.name);
    return this.files.delete(key);
  }

  async getFileUrl(fileId: string, userId: string): Promise<string | null> {
    const files = await this.listUserFiles(userId);
    const file = files.find((f) => f.name.startsWith(fileId));

    if (!file) {
      return null;
    }

    return `http://localhost:4040/files/${fileId}`;
  }

  async getSignedUrl(filePath: string): Promise<string> {
    return `http://localhost:4040/files/${filePath}`;
  }

  async fileExists(filePath: string): Promise<boolean> {
    return this.files.has(filePath);
  }

  async getFileByPath(filePath: string): Promise<Buffer | null> {
    return this.files.get(filePath) || null;
  }

  getPublicUrlForPath(filePath: string): string {
    return `http://localhost:4040/files/${filePath}`;
  }

  getPublicUrl(filePath: string): string {
    return this.getPublicUrlForPath(filePath);
  }

  isOwnedFilePath(userId: string, filePath: string): boolean {
    return filePath.startsWith(`users/${userId}/${this.category}/`);
  }

  async listUserFiles(userId: string): Promise<FileObject[]> {
    const prefix = `users/${userId}/${this.category}/`;
    const userFiles: FileObject[] = [];

    for (const [key, buffer] of this.files.entries()) {
      if (key.startsWith(prefix)) {
        const name = key.replace(prefix, '');
        userFiles.push({ name, size: buffer.byteLength });
      }
    }

    return userFiles;
  }

  async uploadCsvFile(
    fileName: string,
    fileContent: Buffer | string,
    userId: string,
  ): Promise<string> {
    const filename = `${formatTimestampForFileName()}_${sanitizeFileName(fileName)}`;
    const key = this.getKey(userId, filename);

    const buffer = typeof fileContent === 'string' ? Buffer.from(fileContent) : fileContent;
    this.files.set(key, buffer);
    return key;
  }

  async downloadCsvFile(filePath: string): Promise<string> {
    const buffer = this.files.get(filePath);
    if (!buffer) {
      throw new Error('File not found');
    }
    return buffer.toString('utf-8');
  }

  async downloadCsvFileAsBuffer(filePath: string): Promise<Buffer> {
    const buffer = this.files.get(filePath);
    if (!buffer) {
      throw new Error('File not found');
    }
    return buffer;
  }
}

export class R2StorageService {
  client!: S3Client;
  bucketName!: string;
  category!: StorageCategory;
  maxFileSize!: number;
  isPublic!: boolean;
  userScoped!: boolean;
  canCreateBucket!: boolean;
  preparedUploadKeys: Map<string, { key: string; userId: string }> = new Map();

  constructor(category: StorageCategory, options?: StorageOptions) {
    if (getIsTestMode()) {
      const backend = new InMemoryStorageBackend(category, options);
      return new Proxy(backend as R2StorageService, {
        get(_target, prop) {
          return Reflect.get(backend, prop);
        },
        set(_target, prop, value) {
          return Reflect.set(backend, prop, value);
        },
      });
    }

    const storageConfig = getStorageConnectionConfig();

    this.client = new S3Client({
      region: storageConfig.region,
      endpoint: storageConfig.endpoint,
      credentials: {
        accessKeyId: storageConfig.accessKeyId,
        secretAccessKey: storageConfig.secretAccessKey,
      },
      forcePathStyle: storageConfig.forcePathStyle,
    });

    this.bucketName = storageConfig.bucketName;
    this.category = category;
    this.maxFileSize = options?.maxFileSize || 50 * 1024 * 1024;
    this.isPublic = options?.isPublic ?? false;
    this.userScoped = category !== 'places';
    this.canCreateBucket = storageConfig.canCreateBucket;
  }

  getKey(userId: string, filename: string): string {
    if (this.userScoped) {
      return `users/${userId}/${this.category}/${filename}`;
    }
    return `places/place/${filename}`;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (error) {
      if (!this.canCreateBucket) {
        throw getBucketAccessError(this.bucketName, error);
      }

      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucketName,
        }),
      );
    }
  }

  async uploadCsvFile(
    fileName: string,
    fileContent: Buffer | string,
    userId: string,
  ): Promise<string> {
    await this.ensureBucket();

    const filename = `${formatTimestampForFileName()}_${sanitizeFileName(fileName)}`;
    const key = this.getKey(userId, filename);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileContent,
      ContentType: 'text/csv',
    });

    await this.client.send(command);
    return key;
  }

  async storeFile(
    buffer: Buffer,
    mimetype: string,
    userId: string,
    options?: {
      filename?: string;
      originalName?: string;
    },
  ): Promise<StoredFile> {
    if (buffer.byteLength > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }

    await this.ensureBucket();

    const originalName = options?.originalName || options?.filename || 'file';
    const preparedUpload = await this.createPreparedUpload(
      {
        originalName,
        mimetype,
        size: buffer.byteLength,
        ...(options?.filename ? { filename: options.filename } : {}),
      },
      userId,
      3600,
    );

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: preparedUpload.key,
      Body: buffer,
      ContentType: mimetype,
    });

    await this.client.send(command);

    return {
      id: preparedUpload.id,
      originalName: preparedUpload.originalName,
      filename: preparedUpload.key,
      mimetype,
      size: buffer.byteLength,
      url: preparedUpload.url,
      uploadedAt: preparedUpload.uploadedAt,
    };
  }

  async createPreparedUpload(
    input: {
      originalName: string;
      mimetype: string;
      size: number;
      filename?: string;
    },
    userId: string,
    expiresIn = 900,
  ): Promise<PreparedUpload> {
    if (input.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
    }

    if (!this.isValidFileType(input.mimetype)) {
      throw new Error(`Unsupported file type: ${input.mimetype}`);
    }

    await this.ensureBucket();

    const id = crypto.randomUUID();
    const originalName = input.originalName || input.filename || 'file';
    const extension = resolveFileExtension(originalName, input.mimetype);
    const storedName = input.filename
      ? this.createStoredName(id, input.filename, extension)
      : `${id}${extension}`;
    const key = this.getKey(userId, storedName);

    this.markPreparedUpload(id, key, userId);

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        ContentType: input.mimetype,
        ContentLength: input.size,
      }),
      { expiresIn },
    );

    return {
      id,
      key,
      originalName,
      mimetype: input.mimetype,
      size: input.size,
      uploadUrl,
      headers: {
        'content-type': input.mimetype,
      },
      url: this.getPublicUrl(key),
      uploadedAt: new Date(),
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async downloadCsvFile(filePath: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('No file data received');
    }

    return await response.Body.transformToString();
  }

  async downloadCsvFileAsBuffer(filePath: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });

    const response = await this.client.send(command);

    if (!response.Body) {
      throw new Error('No file data received');
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async getFile(fileId: string, userId: string): Promise<ArrayBuffer | null> {
    try {
      const files = await this.listUserFiles(userId);
      const file = files.find((f) => f.name.startsWith(fileId));

      if (!file) {
        return null;
      }

      const key = this.getKey(userId, file.name);
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        return null;
      }

      const bytes = await response.Body.transformToByteArray();
      return bytes.buffer as ArrayBuffer;
    } catch {
      return null;
    }
  }

  async deleteFile(fileId: string, userId: string): Promise<boolean> {
    try {
      const files = await this.listUserFiles(userId);
      const file = files.find((f) => f.name.startsWith(fileId));

      if (!file) {
        return false;
      }

      const key = this.getKey(userId, file.name);
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  async getFileUrl(fileId: string, userId: string): Promise<string | null> {
    try {
      const files = await this.listUserFiles(userId);
      const file = files.find((f) => f.name.startsWith(fileId));

      if (!file) {
        return null;
      }

      const key = this.getKey(userId, file.name);
      return this.getPublicUrl(key);
    } catch {
      return null;
    }
  }

  async getSignedUrl(filePath: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: filePath,
        }),
      );

      return true;
    } catch {
      return false;
    }
  }

  async getFileByPath(filePath: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: filePath,
        }),
      );

      if (!response.Body) {
        return null;
      }

      const bytes = await response.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }

  getPublicUrlForPath(filePath: string): string {
    return this.getPublicUrl(filePath);
  }

  isOwnedFilePath(userId: string, filePath: string): boolean {
    return filePath.startsWith(`users/${userId}/${this.category}/`);
  }

  async listUserFiles(userId: string): Promise<FileObject[]> {
    const prefix = `users/${userId}/${this.category}/`;

    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    });

    const response = await this.client.send(command);

    return (response.Contents || []).map((obj): FileObject => {
      const name = obj.Key?.replace(prefix, '') || '';
      const fileObj: FileObject = { name, size: obj.Size ?? 0 };
      if (obj.LastModified) {
        fileObj.lastModified = obj.LastModified;
      }
      return fileObj;
    });
  }

  getPublicUrl(key: string): string {
    const storageConfig = getStorageConnectionConfig();
    const endpoint = storageConfig.endpoint;
    const bucket = this.bucketName;
    const publicUrl = storageConfig.publicUrl;
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${bucket}/${key}`;
    }

    const url = new URL(endpoint);
    if (storageConfig.forcePathStyle) {
      return `${url.protocol}//${url.host}/${bucket}/${key}`;
    }
    return `${url.protocol}//${bucket}.${url.host}/${key}`;
  }

  createStoredName(id: string, filename: string, extension: string): string {
    return buildStoredFileName(id, filename, extension);
  }

  isValidFileType(mimetype: string): boolean {
    return isSupportedUploadMimeType(mimetype);
  }

  markPreparedUpload(fileId: string, key: string, userId: string): void {
    this.preparedUploadKeys.set(fileId, { key, userId });
  }

  getPreparedUploadInfo(fileId: string): { key: string; userId: string } | undefined {
    return this.preparedUploadKeys.get(fileId);
  }

  async storeFileWithExactKey(filePath: string, buffer: Buffer): Promise<void> {
    if (getIsTestMode()) {
      throw new Error(
        'storeFileWithExactKey is only for test mode and should be called on backend',
      );
    }
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
      Body: buffer,
    });
    await this.client.send(command);
  }
}

const createCsvStorageService = () =>
  new R2StorageService('csvs', {
    maxFileSize: 50 * 1024 * 1024,
    isPublic: false,
  });

const createFileStorageService = () =>
  new R2StorageService('chats', {
    maxFileSize: 10 * 1024 * 1024,
    isPublic: true,
  });

const createPlaceImagesStorageService = () =>
  new R2StorageService('places', {
    maxFileSize: 10 * 1024 * 1024,
    isPublic: true,
  });

function createLazyStorageService(factory: () => R2StorageService): R2StorageService {
  let service: R2StorageService | null = null;

  return new Proxy({} as R2StorageService, {
    get(_target, prop, receiver) {
      service ??= factory();
      return Reflect.get(service, prop, receiver);
    },
    set(_target, prop, value, receiver) {
      service ??= factory();
      return Reflect.set(service, prop, value, receiver);
    },
  });
}

export const csvStorageService = createLazyStorageService(createCsvStorageService);

export const fileStorageService = createLazyStorageService(createFileStorageService);

export const placeImagesStorageService = createLazyStorageService(createPlaceImagesStorageService);

export function createStorageService(
  category: StorageCategory,
  options?: StorageOptions,
): R2StorageService {
  return createLazyStorageService(() => new R2StorageService(category, options));
}
