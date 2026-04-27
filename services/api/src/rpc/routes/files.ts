import type { FileRecord } from '@hominem/db';
import { FileRepository, getDb } from '@hominem/db';
import { fileProcessingQueue } from '@hominem/queues';
import { fileStorageService } from '@hominem/storage';
import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';
import * as z from 'zod';

import { InternalError, NotFoundError, UnavailableError, ValidationError } from '../errors';
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

function toUploadServiceError(error: unknown): Error | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const errorName = error.name.toLowerCase();
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes('missing r2 credentials')) {
    return new UnavailableError('File uploads are unavailable because storage is not configured.');
  }

  if (errorName.includes('s3serviceexception') || errorMessage.includes('unauthorized')) {
    return new UnavailableError(
      'File uploads are unavailable because storage authentication failed.',
    );
  }

  if (
    errorMessage.includes('timeout') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound') ||
    errorMessage.includes('network')
  ) {
    return new UnavailableError(
      'File uploads are temporarily unavailable because storage is unreachable.',
    );
  }

  return null;
}

function logAndThrow(error: unknown, message: string): never {
  logger.error('[files] request failed', { error, message });
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    throw error;
  }
  const uploadServiceError = toUploadServiceError(error);
  if (uploadServiceError) {
    throw uploadServiceError;
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

      const stored = await FileRepository.upsert(getDb(), {
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
        file: toFilePayload(stored),
        message: 'File uploaded successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to upload file');
    }
  });
