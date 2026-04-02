import { db } from '@hominem/db';
import type { JsonValue } from '@hominem/db';
import { FileProcessorService } from '@hominem/services/files';
import { logger } from '@hominem/utils/logger';
import { fileStorageService } from '@hominem/utils/storage';
import { Hono } from 'hono';
import * as z from 'zod';

import { InternalError, NotFoundError, ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

type StoredFileRecord = {
  content: string | null;
  createdat: Date | string;
  id: string;
  metadata: unknown;
  mimetype: string;
  original_name: string;
  owner_userid: string;
  size: number;
  storage_key: string;
  text_content: string | null;
  updatedat: Date | string;
  url: string;
};

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

function toIsoString(value: Date | string | null | undefined): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

function toStoredFilePayload(file: StoredFileRecord) {
  return {
    id: file.id,
    originalName: file.original_name,
    type: file.mimetype.startsWith('image/')
      ? 'image'
      : file.mimetype.startsWith('audio/')
        ? 'audio'
        : file.mimetype.startsWith('video/')
          ? 'video'
          : file.mimetype === 'application/pdf' || file.mimetype.startsWith('text/')
            ? 'document'
            : 'unknown',
    mimetype: file.mimetype,
    size: file.size,
    ...(file.content ? { content: file.content } : {}),
    ...(file.text_content ? { textContent: file.text_content } : {}),
    ...(file.metadata && typeof file.metadata === 'object'
      ? { metadata: file.metadata as Record<string, unknown> }
      : {}),
    url: file.url,
    uploadedAt: toIsoString(file.createdat),
    vectorIds: [],
  };
}

function logAndThrow(error: unknown, message: string): never {
  logger.error('[files] request failed', { error, message });
  if (error instanceof ValidationError || error instanceof NotFoundError) {
    throw error;
  }
  throw new InternalError(message);
}

export const filesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    try {
      const userId = c.get('userId')!;
      const files = (await db
        .selectFrom('app.files')
        .selectAll()
        .where('owner_userid', '=', userId)
        .orderBy('createdat', 'desc')
        .execute()) as StoredFileRecord[];

      return c.json({
        files: files.map((file) => toStoredFilePayload(file as StoredFileRecord)),
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

      const file = (await db
        .selectFrom('app.files')
        .selectAll()
        .where('id', '=', fileId)
        .where('owner_userid', '=', userId)
        .executeTakeFirst()) as StoredFileRecord | undefined;

      if (!file) {
        throw new NotFoundError('File');
      }

      return c.json({
        file: toStoredFilePayload(file as StoredFileRecord),
      });
    } catch (error) {
      logAndThrow(error, 'Failed to fetch file');
    }
  })
  .get('/:fileId/url', async (c) => {
    try {
      const userId = c.get('userId')!;
      const fileId = c.req.param('fileId');
      const file = (await db
        .selectFrom('app.files')
        .select(['url'])
        .where('id', '=', fileId)
        .where('owner_userid', '=', userId)
        .executeTakeFirst()) as { url: string } | undefined;

      if (!file) {
        throw new NotFoundError('File');
      }

      return c.json({
        url: file.url,
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

      const existing = (await db
        .selectFrom('app.files')
        .select(['id'])
        .where('id', '=', fileId)
        .where('owner_userid', '=', userId)
        .executeTakeFirst()) as { id: string } | undefined;

      if (!existing) {
        throw new NotFoundError('File');
      }

      await fileStorageService.deleteFile(fileId, userId);
      await db
        .deleteFrom('app.files')
        .where('id', '=', fileId)
        .where('owner_userid', '=', userId)
        .execute();

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

      const processed = await FileProcessorService.processFile(
        Uint8Array.from(fileBuffer).buffer,
        parsed.data.originalName,
        parsed.data.mimetype,
        parsed.data.fileId,
      );

      const url = fileStorageService.getPublicUrlForPath(parsed.data.key);
      const now = new Date().toISOString();

      await db
        .insertInto('app.files')
        .values({
          id: parsed.data.fileId,
          owner_userid: userId,
          storage_key: parsed.data.key,
          original_name: parsed.data.originalName,
          mimetype: parsed.data.mimetype,
          size: parsed.data.size,
          url,
          content: processed.content ?? null,
          text_content: processed.textContent ?? null,
          metadata: (processed.metadata ?? null) as JsonValue | null,
          createdat: now,
          updatedat: now,
        })
        .onConflict((oc) =>
          oc.column('id').doUpdateSet({
            storage_key: parsed.data.key,
            original_name: parsed.data.originalName,
            mimetype: parsed.data.mimetype,
            size: parsed.data.size,
            url,
            content: processed.content ?? null,
            text_content: processed.textContent ?? null,
            metadata: (processed.metadata ?? null) as JsonValue | null,
            updatedat: now,
          }),
        )
        .execute();

      const stored = (await db
        .selectFrom('app.files')
        .selectAll()
        .where('id', '=', parsed.data.fileId)
        .where('owner_userid', '=', userId)
        .executeTakeFirstOrThrow()) as StoredFileRecord;

      return c.json({
        success: true,
        file: toStoredFilePayload(stored as StoredFileRecord),
        message: 'Upload completed successfully',
      });
    } catch (error) {
      logAndThrow(error, 'Failed to complete upload');
    }
  });
