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

import { isSupportedChatUploadMimeType } from '../upload';
import type { FileObject, PreparedUpload, StorageOptions, StoredFile } from './types';

type StorageCategory = 'csvs' | 'chats' | 'places';

function getIsTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

class InMemoryStorageBackend {
  private files: Map<string, Buffer> = new Map();
  private maxFileSize: number;
  private isPublic: boolean;
  private category: StorageCategory;
  private pendingUploads: Map<string, { buffer?: Buffer; mimetype: string; size: number }> =
    new Map();
  private preparedUploadKeys: Map<string, { key: string; userId: string }> = new Map();

  constructor(category: StorageCategory, options?: StorageOptions) {
    this.category = category;
    this.maxFileSize = options?.maxFileSize || 50 * 1024 * 1024;
    this.isPublic = options?.isPublic ?? false;
  }

  /**
   * Test-only method to store a file with an exact key.
   * Only available in test mode.
   */
  __testOnlyStoreFile(filePath: string, buffer: Buffer): void {
    if (!getIsTestMode()) {
      throw new Error('__testOnlyStoreFile is only available in test mode');
    }
    this.files.set(filePath, buffer);
    this.pendingUploads.delete(filePath);
  }

  /** @deprecated Use __testOnlyStoreFile instead */
  storeFileWithExactKey(filePath: string, buffer: Buffer): void {
    this.__testOnlyStoreFile(filePath, buffer);
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

  private getKey(userId: string, filename: string): string {
    return `users/${userId}/${this.category}/${filename}`;
  }

  private getFileExtension(filename: string, mimetype: string): string {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex !== -1) {
      return filename.substring(dotIndex);
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'text/csv': '.csv',
      'application/csv': '.csv',
    };

    return mimeToExt[mimetype] || '';
  }

  private createStoredName(id: string, filename: string, extension: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const withExtension = sanitized.endsWith(extension) ? sanitized : `${sanitized}${extension}`;
    return `${id}-${withExtension}`;
  }

  isValidFileType(mimetype: string): boolean {
    return isSupportedChatUploadMimeType(mimetype);
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
    const extension = this.getFileExtension(originalName, input.mimetype);
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
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedFileName}`;
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
  private client!: S3Client;
  private bucketName!: string;
  private category!: StorageCategory;
  private maxFileSize!: number;
  private isPublic!: boolean;
  private userScoped!: boolean;
  private preparedUploadKeys: Map<string, { key: string; userId: string }> = new Map();

  constructor(category: StorageCategory, options?: StorageOptions) {
    if (getIsTestMode()) {
      const backend = new InMemoryStorageBackend(category, options);
      return new Proxy(backend as unknown as R2StorageService, {
        get(_target, prop) {
          return Reflect.get(backend, prop);
        },
        set(_target, prop, value) {
          return Reflect.set(backend, prop, value);
        },
      });
    }

    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'Missing R2 credentials. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY environment variables.',
      );
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucketName = process.env.R2_BUCKET_NAME || 'hominem-storage';
    this.category = category;
    this.maxFileSize = options?.maxFileSize || 50 * 1024 * 1024;
    this.isPublic = options?.isPublic ?? false;
    this.userScoped = category !== 'places';
  }

  private getKey(userId: string, filename: string): string {
    if (this.userScoped) {
      return `users/${userId}/${this.category}/${filename}`;
    }
    return `places/place/${filename}`;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucketName,
          ACL: this.isPublic ? 'public-read' : 'private',
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

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${timestamp}_${sanitizedFileName}`;
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
    const extension = this.getFileExtension(originalName, input.mimetype);
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

  private getPublicUrl(key: string): string {
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = this.bucketName;
    if (!endpoint) {
      throw new Error('R2_ENDPOINT not configured');
    }
    const url = new URL(endpoint);
    return `${url.protocol}//${bucket}.${url.host}/${key}`;
  }

  private getFileExtension(filename: string, mimetype: string): string {
    const dotIndex = filename.lastIndexOf('.');
    if (dotIndex !== -1) {
      return filename.substring(dotIndex);
    }

    const mimeToExt: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/msword': '.doc',
      'audio/mpeg': '.mp3',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'text/csv': '.csv',
      'application/csv': '.csv',
    };

    return mimeToExt[mimetype] || '';
  }

  private createStoredName(id: string, filename: string, extension: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const withExtension = sanitized.endsWith(extension) ? sanitized : `${sanitized}${extension}`;

    return `${id}-${withExtension}`;
  }

  isValidFileType(mimetype: string): boolean {
    return isSupportedChatUploadMimeType(mimetype);
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
