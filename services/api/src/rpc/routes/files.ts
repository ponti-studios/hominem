import { FileRepository, getDb } from '@hominem/db';
import type { FileRecord } from '@hominem/db';
import { FileProcessorService } from '@hominem/services/files';
import { logger } from '@hominem/utils/logger';
import { fileStorageService } from '@hominem/utils/storage';
import { Hono } from 'hono';
import * as z from 'zod';

import { InternalError, NotFoundError, ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

const uploadMetadataSchema = z.object({
  originalName: z.string().min(1),
  mimetype: z.string().min(1),
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
  .post('/', async (c) => {
    try {
      const userId = c.get('userId')!;
      const body = await c.req.parseBody();
      const file = body.file;

      if (!(file instanceof File)) {
        throw new ValidationError('File is required');
      }

      const parsed = uploadMetadataSchema.safeParse({
        originalName: typeof body.originalName === 'string' ? body.originalName : file.name,
        mimetype: typeof body.mimetype === 'string' ? body.mimetype : file.type,
      });

      if (!parsed.success) {
        throw new ValidationError(parsed.error.issues[0]?.message ?? 'Invalid upload metadata');
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer());
      if (fileBuffer.byteLength === 0) {
        throw new ValidationError('Uploaded file cannot be empty');
      }

      const storedFile = await fileStorageService.storeFile(
        fileBuffer,
        parsed.data.mimetype,
        userId,
        {
          originalName: parsed.data.originalName,
        },
      );

      // TODO: Move file processing to background queue (BullMQ infra exists)
      const processed = await FileProcessorService.processFile(
        Uint8Array.from(fileBuffer).buffer,
        parsed.data.originalName,
        parsed.data.mimetype,
        storedFile.id,
      );

      const stored = await FileRepository.upsert(getDb(), {
        id: storedFile.id,
        userId,
        storageKey: storedFile.filename,
        originalName: parsed.data.originalName,
        mimetype: parsed.data.mimetype,
        size: fileBuffer.byteLength,
        url: storedFile.url,
        ...(processed.content != null ? { content: processed.content } : {}),
        ...(processed.textContent != null ? { textContent: processed.textContent } : {}),
        ...(processed.metadata != null ? { metadata: processed.metadata } : {}),
      });

      return c.json({
        success: true,
        file: toFilePayload(stored),
        message: 'File uploaded successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to upload file');
    }
  });
