import { isObject } from '@hominem/utils';
import { sql, type Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppFiles, JsonObject } from '../../types/database';
import {
  PAGE_DEFAULT_LIMIT,
  decodePageCursor,
  encodePageCursor,
  toPage,
  type Page,
} from '../pagination';

type FileRow = Selectable<AppFiles>;

export interface FileRecord {
  id: string;
  userId: string;
  originalName: string;
  type: 'image' | 'audio' | 'video' | 'document' | 'unknown';
  mimetype: string;
  size: number;
  url: string;
  content?: string;
  textContent?: string;
  metadata?: JsonObject;
  uploadedAt: string;
}

export interface UpsertFileInput {
  id: string;
  userId: string;
  storageKey: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  content?: string | null;
  textContent?: string | null;
  metadata?: JsonObject | null;
}

export interface CreatePendingFileInput {
  id: string;
  userId: string;
  storageKey: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface PendingFile {
  id: string;
  userId: string;
  storageKey: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface DeleteFileCommand {
  fileId: string;
  userId: string;
}

function deriveFileType(mimetype: string): FileRecord['type'] {
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  if (mimetype.startsWith('video/')) return 'video';
  if (
    mimetype === 'application/pdf' ||
    mimetype.startsWith('text/') ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return 'document';
  }
  return 'unknown';
}

function toFileRecord(row: FileRow): FileRecord {
  return {
    id: row.id,
    userId: row.ownerUserid,
    originalName: row.originalName,
    type: deriveFileType(row.mimetype),
    mimetype: row.mimetype,
    size: row.size,
    url: row.url,
    ...(row.content ? { content: row.content } : {}),
    ...(row.textContent ? { textContent: row.textContent } : {}),
    ...(isObject(row.metadata) ? { metadata: row.metadata } : {}),
    uploadedAt: new Date(row.createdat).toISOString(),
  };
}

export const FileRepository = {
  async listForUser(handle: DbHandle, userId: string): Promise<FileRecord[]> {
    const files = await handle
      .selectFrom('app.files')
      .selectAll()
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'ready')
      .orderBy('createdat', 'desc')
      .execute();

    return files.map(toFileRecord);
  },

  // Listed by upload time, newest first, with `id` as the tiebreaker that gives the keyset walk a
  // total order. The cursor carries PostgreSQL's own microsecond timestamp text, not the
  // millisecond ISO `uploadedAt`, so files uploaded in the same millisecond are not skipped.
  async listPage(
    handle: DbHandle,
    userId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<Page<FileRecord>> {
    const limit = opts?.limit ?? PAGE_DEFAULT_LIMIT;
    const cursor = opts?.cursor
      ? decodePageCursor(opts.cursor, { route: 'files', filter: '', keys: ['timestamp', 'uuid'] })
      : null;

    let query = handle.selectFrom('app.files').selectAll().where('ownerUserid', '=', userId);

    if (cursor) {
      const [createdAt, id] = cursor;
      query = query.where(
        sql<boolean>`("createdat", "id") < (${createdAt}::timestamptz, ${id}::uuid)`,
      );
    }

    const rows = await query
      .orderBy('createdat', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .execute();

    const page = toPage(rows, limit, (last) =>
      encodePageCursor('files', '', [last.createdat, last.id]),
    );
    return { items: page.items.map(toFileRecord), next: page.next };
  },

  async getOwned(handle: DbHandle, fileId: string, userId: string): Promise<FileRecord | null> {
    const file = await handle
      .selectFrom('app.files')
      .selectAll()
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'ready')
      .executeTakeFirst();

    return file ? toFileRecord(file) : null;
  },

  async getStorageKey(handle: DbHandle, fileId: string, userId: string): Promise<string | null> {
    const row = await handle
      .selectFrom('app.files')
      .select('storageKey')
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'ready')
      .executeTakeFirst();

    return row?.storageKey ?? null;
  },

  async getOwnedOrThrow(handle: DbHandle, fileId: string, userId: string): Promise<FileRecord> {
    const file = await FileRepository.getOwned(handle, fileId, userId);
    if (!file) {
      throw new NotFoundError('File', { fileId });
    }
    return file;
  },

  async getUrl(handle: DbHandle, fileId: string, userId: string): Promise<string> {
    const file = await handle
      .selectFrom('app.files')
      .select(['url'])
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'ready')
      .executeTakeFirst();

    if (!file) {
      throw new NotFoundError('File', { fileId });
    }

    return file.url;
  },

  async existsForUser(handle: DbHandle, fileId: string, userId: string): Promise<boolean> {
    const file = await handle
      .selectFrom('app.files')
      .select(['id'])
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'ready')
      .executeTakeFirst();

    return Boolean(file);
  },

  // Called after an upload finishes
  async upsert(handle: DbHandle, input: UpsertFileInput): Promise<FileRecord> {
    const now = new Date().toISOString();

    await handle
      .insertInto('app.files')
      .values({
        id: input.id,
        ownerUserid: input.userId,
        storageKey: input.storageKey,
        originalName: input.originalName,
        mimetype: input.mimetype,
        size: input.size,
        url: input.url,
        status: 'ready',
        content: input.content ?? null,
        textContent: input.textContent ?? null,
        metadata: input.metadata ?? null,
        createdat: now,
        updatedat: now,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          storageKey: input.storageKey,
          originalName: input.originalName,
          mimetype: input.mimetype,
          size: input.size,
          url: input.url,
          status: 'ready',
          content: input.content ?? null,
          textContent: input.textContent ?? null,
          metadata: input.metadata ?? null,
          updatedat: now,
        }),
      )
      .execute();

    return FileRepository.getOwnedOrThrow(handle, input.id, input.userId);
  },

  // An upload that has been handed a presigned URL but not yet verified. Never shown to the user
  // (every read above filters on status = ready). `url` stays empty: it is not a public URL
  // anymore, reads are signed on demand from storageKey.
  async createPending(handle: DbHandle, input: CreatePendingFileInput): Promise<void> {
    await handle
      .insertInto('app.files')
      .values({
        id: input.id,
        ownerUserid: input.userId,
        storageKey: input.storageKey,
        originalName: input.originalName,
        mimetype: input.mimetype,
        size: input.size,
        url: '',
        status: 'pending',
      })
      .execute();
  },

  async getPending(handle: DbHandle, fileId: string, userId: string): Promise<PendingFile | null> {
    const row = await handle
      .selectFrom('app.files')
      .select(['id', 'ownerUserid', 'storageKey', 'originalName', 'mimetype', 'size'])
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'pending')
      .executeTakeFirst();

    return row
      ? {
          id: row.id,
          userId: row.ownerUserid,
          storageKey: row.storageKey,
          originalName: row.originalName,
          mimetype: row.mimetype,
          size: row.size,
        }
      : null;
  },

  // Flips a verified upload to ready and records its final (promoted) key and stored url. Only touches rows that
  // are still pending, so completing twice can't resurrect a different object.
  async markReady(
    handle: DbHandle,
    fileId: string,
    userId: string,
    ready: { storageKey: string; url: string },
  ): Promise<FileRecord> {
    const updated = await handle
      .updateTable('app.files')
      .set({
        status: 'ready',
        storageKey: ready.storageKey,
        url: ready.url,
        updatedat: new Date().toISOString(),
      })
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'pending')
      .returning('id')
      .executeTakeFirst();

    if (!updated) throw new NotFoundError('File', { fileId });
    return FileRepository.getOwnedOrThrow(handle, fileId, userId);
  },

  async deletePending(handle: DbHandle, fileId: string, userId: string): Promise<void> {
    await handle
      .deleteFrom('app.files')
      .where('id', '=', fileId)
      .where('ownerUserid', '=', userId)
      .where('status', '=', 'pending')
      .execute();
  },

  async delete(handle: DbHandle, command: DeleteFileCommand): Promise<void> {
    const deleted = await handle
      .deleteFrom('app.files')
      .where('id', '=', command.fileId)
      .where('ownerUserid', '=', command.userId)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw new NotFoundError('File', { fileId: command.fileId });
  },
};
