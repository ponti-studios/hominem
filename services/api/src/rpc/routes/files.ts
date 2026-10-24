import { db } from '@hominem/db/core';
import type { FileRecord } from '@hominem/db/files';
import { FileRepository } from '@hominem/db/files';
import { fileProcessingQueue } from '@hominem/queues';
import { fileStorageService, isStorageServiceError, sniffContent } from '@hominem/storage';
import { isSupportedUploadMimeType, UPLOAD_MAX_FILE_SIZE_BYTES } from '@hominem/storage/constants';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';

import { UploadIntentSchema, UploadMetadataSchema } from '../../schemas/files.schema';
import {
  getServiceErrorFailureType,
  InternalError,
  NotFoundError,
  UnavailableError,
  ValidationError,
} from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rate-limit';
import { signFileUrl } from './file-urls';

async function toFilePayload(file: FileRecord) {
  return {
    id: file.id,
    originalName: file.originalName,
    type: file.type,
    mimetype: file.mimetype,
    size: file.size,
    ...(file.content ? { content: file.content } : {}),
    ...(file.textContent ? { textContent: file.textContent } : {}),
    ...(file.metadata ? { metadata: file.metadata } : {}),
    url: await signFileUrl(file.url, file),
    uploadedAt: file.uploadedAt,
    vectorIds: [],
  };
}

function toUploadServiceError(error: unknown): Error | null {
  if (isStorageServiceError(error)) {
    switch (error.code) {
      case 'storage.config.missing':
        return new UnavailableError(
          'File uploads are unavailable because storage is not configured.',
          undefined,
          'file.storage.config_missing',
        );
      case 'storage.credentials.invalid':
      case 'storage.bucket.access_denied':
        return new UnavailableError(
          'File uploads are unavailable because storage authentication failed.',
          undefined,
          'file.storage.credentials_invalid',
        );
      case 'storage.network.unreachable':
        return new UnavailableError(
          'File uploads are temporarily unavailable because storage is unreachable.',
          undefined,
          'file.storage.network_unreachable',
        );
      case 'storage.bucket.missing':
        return new UnavailableError(
          'File uploads are unavailable because the storage bucket is missing.',
          undefined,
          'file.storage.bucket_missing',
        );
      default:
        return new UnavailableError(
          'File uploads are unavailable because storage failed.',
          undefined,
          'file.storage.failed',
        );
    }
  }

  return null;
}

function logAndThrow(
  error: unknown,
  message: string,
  operation: 'file.upload' | 'file.delete',
): never {
  const serviceError =
    error instanceof ValidationError || error instanceof NotFoundError
      ? error
      : toUploadServiceError(error);
  logger.error('file_request_failed', {
    operation,
    failureType:
      serviceError instanceof ValidationError
        ? 'file.upload.invalid_input'
        : serviceError instanceof UnavailableError
          ? getServiceErrorFailureType(serviceError)
          : serviceError instanceof NotFoundError
            ? getServiceErrorFailureType(serviceError)
            : operation === 'file.upload'
              ? 'file.upload.failed'
              : 'file.delete.failed',
    ...(serviceError instanceof ValidationError ||
    serviceError instanceof NotFoundError ||
    serviceError instanceof UnavailableError
      ? { failureCategory: serviceError.code.toLowerCase() }
      : {}),
    error_name: error instanceof Error ? error.name : 'unknown',
  });
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    throw error;
  }
  if (serviceError) {
    throw serviceError;
  }
  // Anything else with a `code` (e.g. DB errors) gets re-thrown as-is
  if (error instanceof Error && 'code' in error) {
    throw error;
  }
  throw new InternalError(message);
}

export const filesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  // Step 1 of a direct upload: reserve a pending row and hand back a short-lived presigned PUT.
  // The browser/app sends bytes straight to R2 (into quarantine); nothing is trusted until /complete.
  .post(
    '/uploads',
    rateLimitMiddleware({ bucket: 'file-upload-init', windowSec: 3600, max: 60 }),
    async (c) => {
      try {
        const userId = c.get('auth')!.userId;
        const parsed = UploadIntentSchema.safeParse(await c.req.json().catch(() => null));
        if (!parsed.success) {
          throw new ValidationError(
            parsed.error.issues[0]?.message ?? 'Invalid upload request',
            undefined,
            'file.upload.invalid_input',
          );
        }
        const { originalName, mimetype, size } = parsed.data;
        if (!isSupportedUploadMimeType(mimetype)) {
          throw new ValidationError(
            'Unsupported file type',
            undefined,
            'file.upload.invalid_input',
          );
        }
        if (size > UPLOAD_MAX_FILE_SIZE_BYTES) {
          throw new ValidationError('File is too large', undefined, 'file.upload.invalid_input');
        }

        const intent = await fileStorageService.createUploadIntent({ mimetype, size }, userId);
        await FileRepository.createPending(db, {
          id: intent.id,
          userId,
          storageKey: intent.quarantineKey,
          originalName,
          mimetype,
          size,
        });

        return c.json({
          id: intent.id,
          method: 'PUT',
          uploadUrl: intent.uploadUrl,
          headers: intent.headers,
          expiresAt: intent.expiresAt,
        });
      } catch (error) {
        logAndThrow(error, 'Failed to start upload', 'file.upload');
      }
    },
  )
  // Step 2: the client says it's done. We check the object ourselves (size, magic bytes), promote
  // it out of quarantine, and only then does the file exist as far as the rest of the app cares.
  .post('/uploads/:fileId/complete', async (c) => {
    try {
      const userId = c.get('auth')!.userId;
      const fileId = c.req.param('fileId');

      const pending = await FileRepository.getPending(db, fileId, userId);
      if (!pending) throw new NotFoundError('File', { fileId });

      const result = await fileStorageService.finalizeUpload({
        id: pending.id,
        userId,
        mimetype: pending.mimetype,
        size: pending.size,
        originalName: pending.originalName,
      });

      if (!result.ok) {
        // Bad or missing bytes: the object is already gone from quarantine, drop the row too.
        await FileRepository.deletePending(db, fileId, userId);
        throw new ValidationError(
          result.reason === 'missing'
            ? 'Upload was not received'
            : 'Uploaded file did not pass verification',
          undefined,
          'file.upload.invalid_input',
        );
      }

      const url = fileStorageService.getPublicUrl(result.key);
      const stored = await FileRepository.markReady(db, fileId, userId, {
        storageKey: result.key,
        url,
      });

      await fileProcessingQueue.add(
        'process-file',
        {
          jobId: fileId,
          userId,
          fileId,
          storageKey: result.key,
          url,
          originalName: pending.originalName,
          mimetype: pending.mimetype,
          size: result.size,
        },
        { jobId: fileId, removeOnComplete: true, removeOnFail: false },
      );

      return c.json({
        success: true,
        file: await toFilePayload(stored),
        message: 'File uploaded successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to complete upload', 'file.upload');
    }
  })
  // A fresh signed URL on demand, for when one handed out earlier has expired.
  .get('/:fileId/url', async (c) => {
    const userId = c.get('auth')!.userId;
    const file = await FileRepository.getOwned(db, c.req.param('fileId'), userId);
    if (!file) throw new NotFoundError('File', { fileId: c.req.param('fileId') });
    return c.json({ url: await signFileUrl(file.url, file) });
  })
  .delete('/:fileId', async (c) => {
    try {
      const userId = c.get('auth')!.userId;
      const fileId = c.req.param('fileId');

      if (!(await FileRepository.existsForUser(db, fileId, userId))) {
        throw new NotFoundError('File');
      }

      await fileStorageService.deleteFile(fileId, userId);
      await FileRepository.delete(db, { fileId, userId });

      return c.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      logAndThrow(error, 'Failed to delete file', 'file.delete');
    }
  })
  .post('/', async (c) => {
    try {
      const userId = c.get('auth')!.userId;
      const body = await c.req.parseBody();
      const file = body.file;

      if (!(file instanceof File)) {
        throw new ValidationError('File is required', undefined, 'file.upload.invalid_input');
      }

      const parsed = UploadMetadataSchema.safeParse({
        originalName: typeof body.originalName === 'string' ? body.originalName : file.name,
        mimetype: typeof body.mimetype === 'string' ? body.mimetype : file.type,
      });

      if (!parsed.success) {
        throw new ValidationError(
          parsed.error.issues[0]?.message ?? 'Invalid upload metadata',
          undefined,
          'file.upload.invalid_input',
        );
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      if (fileBuffer.byteLength === 0) {
        throw new ValidationError(
          'Uploaded file cannot be empty',
          undefined,
          'file.upload.invalid_input',
        );
      }

      // Same checks the direct-upload path does: allowed type, size cap, and the bytes have to
      // actually be what the client says they are.
      if (!isSupportedUploadMimeType(parsed.data.mimetype)) {
        throw new ValidationError('Unsupported file type', undefined, 'file.upload.invalid_input');
      }
      if (fileBuffer.byteLength > UPLOAD_MAX_FILE_SIZE_BYTES) {
        throw new ValidationError('File is too large', undefined, 'file.upload.invalid_input');
      }
      const sniffed = await sniffContent(fileBuffer, parsed.data.mimetype);
      if (!sniffed.ok) {
        throw new ValidationError(
          'File contents do not match the declared type',
          undefined,
          'file.upload.invalid_input',
        );
      }

      const storedFile = await fileStorageService.storeFile(
        fileBuffer,
        parsed.data.mimetype,
        userId,
        {
          originalName: parsed.data.originalName,
        },
      );

      const stored = await FileRepository.upsert(db, {
        id: storedFile.id,
        userId,
        storageKey: storedFile.filename,
        originalName: parsed.data.originalName,
        mimetype: parsed.data.mimetype,
        size: fileBuffer.byteLength,
        url: storedFile.url,
      });

      await fileProcessingQueue.add(
        'process-file',
        {
          jobId: storedFile.id,
          userId,
          fileId: storedFile.id,
          storageKey: storedFile.filename,
          url: storedFile.url,
          originalName: parsed.data.originalName,
          mimetype: parsed.data.mimetype,
          size: fileBuffer.byteLength,
        },
        {
          jobId: storedFile.id,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      return c.json({
        success: true,
        file: await toFilePayload(stored),
        message: 'File uploaded successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to upload file', 'file.upload');
    }
  });
