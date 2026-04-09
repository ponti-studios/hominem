import { FileRepository, getDb } from '@hominem/db';
import type { FileRecord } from '@hominem/db';
import { FileProcessorService } from '@hominem/services/files';
import { logger } from '@hominem/utils/logger';
import { fileStorageService } from '@hominem/utils/storage';
import { Hono } from 'hono';
import * as z from 'zod';

import { InternalError, NotFoundError, ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

// Track prepared uploads so the presigned upload endpoint can store to the correct location
// Maps fileId -> { key, userId }
const preparedUploadMap = new Map<string, { key: string; userId: string }>();

const prepareUploadSchema = z.object({
  originalName: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().positive(),
});

const completeUploadSchema = z.object({
  fileId: z.uuid(),
  key: z.string().min(1),
  originalName: z.string().min(1),
  mimetype: z.string().min(1),
  size: z.number().positive(),
});

function toFilePayload(file: FileRecord) {
  return {
    id: file.id,
    originalName: file.originalName,
    type: file.type,
    mimetype: file.mimetype,
    size: file.size,
    ...(file.content ? { content: file.content } : {}),
    ...(file.textContent ? { textContent: file.textContent } : {}),
    ...(file.metadata ? { metadata: file.metadata } : {}),
    url: file.url,
    uploadedAt: file.uploadedAt,
    vectorIds: [],
  };
}

function logAndThrow(error: unknown, message: string): never {
  logger.error('[files] request failed', { error, message });
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    throw error;
  }
  // Re-throw repository errors (which include NotFoundError from @hominem/db)
  if (error instanceof Error && 'code' in error) {
    throw error;
  }
  throw new InternalError(message);
}

// Public route for presigned-style uploads (no auth required)
// This mimics S3 presigned URLs - the client has the right to PUT to their fileId
export const uploadBytesRoute = new Hono<AppContext>().put('/:fileId', async (c) => {
  try {
    const fileId = c.req.param('fileId');
    
    if (!fileId) {
      throw new ValidationError('File ID is required');
    }

    const body = await c.req.arrayBuffer();
    const buffer = Buffer.from(body);

    if (buffer.length === 0) {
      throw new ValidationError('Upload body cannot be empty');
    }

    // Get the prepared upload info to find the key and userId
    const preparedInfo = preparedUploadMap.get(fileId);
    if (!preparedInfo) {
      throw new ValidationError('File ID was not prepared. Call prepare-upload first.');
    }

    const { key, userId } = preparedInfo;

    // Store the bytes directly to the prepared location
    // In test mode, directly store to the prepared location
    // In production, S3 would have already stored it when we PUT to the presigned URL
    const backend = (fileStorageService as any);
    if (backend.__testOnlyStoreFile) {
      backend.__testOnlyStoreFile(key, Buffer.from(body));
    } else {
      // In production, this endpoint shouldn't be called - presigned URLs go directly to S3
      throw new Error('uploadBytesRoute should only be called in test mode');
    }

    // Clean up the prepared upload record
    preparedUploadMap.delete(fileId);

    return c.json({
      success: true,
      fileId,
      key,
      message: 'Bytes uploaded successfully',
    });
  } catch (error) {
    logAndThrow(error, 'Failed to upload bytes');
  }
});

export const filesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    try {
      const userId = c.get('userId')!;
      const files = await FileRepository.listForUser(getDb(), userId);

      return c.json({
        files: files.map(toFilePayload),
        count: files.length,
      });
    } catch (error) {
      logAndThrow(error, 'Failed to list files');
    }
  })
  .get('/:fileId', async (c) => {
    try {
      const userId = c.get('userId')!;
      const fileId = c.req.param('fileId');
      const file = await FileRepository.getOwnedOrThrow(getDb(), fileId, userId);

      return c.json({ file: toFilePayload(file) });
    } catch (error) {
      logAndThrow(error, 'Failed to fetch file');
    }
  })
  .get('/:fileId/url', async (c) => {
    try {
      const userId = c.get('userId')!;
      const fileId = c.req.param('fileId');
      const url = await FileRepository.getUrl(getDb(), fileId, userId);

      return c.json({
        url,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        message: 'URL generated successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to generate file URL');
    }
  })
  .delete('/:fileId', async (c) => {
    try {
      const userId = c.get('userId')!;
      const fileId = c.req.param('fileId');
      const db = getDb();

      const exists = await FileRepository.existsForUser(db, fileId, userId);
      if (!exists) {
        throw new NotFoundError('File');
      }

      await fileStorageService.deleteFile(fileId, userId);
      await FileRepository.delete(db, fileId, userId);

      return c.json({ success: true, message: 'File deleted successfully' });
    } catch (error) {
      logAndThrow(error, 'Failed to delete file');
    }
  })
  .post('/prepare-upload', async (c) => {
    try {
      const userId = c.get('userId')!;
      const body = await c.req.json();
      const parsed = prepareUploadSchema.safeParse(body);

      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid upload request');
      }

      const prepared = await fileStorageService.createPreparedUpload(parsed.data, userId);

      // Register this prepared upload so the presigned upload endpoint knows where to store it
      preparedUploadMap.set(prepared.id, { key: prepared.key, userId });

      return c.json({
        fileId: prepared.id,
        key: prepared.key,
        originalName: prepared.originalName,
        mimetype: prepared.mimetype,
        size: prepared.size,
        uploadUrl: prepared.uploadUrl,
        headers: prepared.headers,
        url: prepared.url,
        uploadedAt: prepared.uploadedAt.toISOString(),
        expiresAt: prepared.expiresAt.toISOString(),
      });
    } catch (error) {
      logAndThrow(error, 'Failed to prepare upload');
    }
  })
  .post('/complete-upload', async (c) => {
    try {
      const userId = c.get('userId')!;
      const body = await c.req.json();
      const parsed = completeUploadSchema.safeParse(body);

      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid upload completion');
      }

      if (!fileStorageService.isOwnedFilePath(userId, parsed.data.key)) {
        throw new ValidationError('Upload key does not belong to the current user');
      }

      const exists = await fileStorageService.fileExists(parsed.data.key);
      if (!exists) {
        throw new NotFoundError('Uploaded object');
      }

      const fileBuffer = await fileStorageService.getFileByPath(parsed.data.key);
      if (!fileBuffer) {
        throw new NotFoundError('Uploaded object');
      }

      // TODO: Move file processing to background queue (BullMQ infra exists)
      const processed = await FileProcessorService.processFile(
        Uint8Array.from(fileBuffer).buffer,
        parsed.data.originalName,
        parsed.data.mimetype,
        parsed.data.fileId,
      );

      const url = fileStorageService.getPublicUrlForPath(parsed.data.key);

      const stored = await FileRepository.upsert(getDb(), {
        id: parsed.data.fileId,
        userId,
        storageKey: parsed.data.key,
        originalName: parsed.data.originalName,
        mimetype: parsed.data.mimetype,
        size: parsed.data.size,
        url,
        ...(processed.content != null ? { content: processed.content } : {}),
        ...(processed.textContent != null ? { textContent: processed.textContent } : {}),
        ...(processed.metadata != null ? { metadata: processed.metadata } : {}),
      });

      return c.json({
        success: true,
        file: toFilePayload(stored),
        message: 'Upload completed successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to complete upload');
    }
  });
