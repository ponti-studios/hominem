import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppFiles, JsonValue } from '../../types/database';
import { toRequiredIsoString } from '../_shared/mappers';

// ─── Row types ───────────────────────────────────────────────────────────────

type FileRow = Selectable<AppFiles>;

// ─── Domain output types ─────────────────────────────────────────────────────

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
  metadata?: Record<string, unknown>;
  uploadedAt: string;
}

// ─── Input types ─────────────────────────────────────────────────────────────

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
  metadata?: Record<string, unknown> | null;
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

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
    userId: row.owner_userid,
    originalName: row.original_name,
    type: deriveFileType(row.mimetype),
    mimetype: row.mimetype,
    size: row.size,
    url: row.url,
    ...(row.content ? { content: row.content } : {}),
    ...(row.text_content ? { textContent: row.text_content } : {}),
    ...(row.metadata && typeof row.metadata === 'object'
      ? { metadata: row.metadata as Record<string, unknown> }
      : {}),
    uploadedAt: toRequiredIsoString(row.createdat),
  };
}

// ─── Repository ──────────────────────────────────────────────────────────────

export const FileRepository = {
  /**
   * List all files for a user.
   */
  async listForUser(handle: DbHandle, userId: string): Promise<FileRecord[]> {
    const files = (await handle
      .selectFrom('app.files')
      .selectAll()
      .where('owner_userid', '=', userId)
      .orderBy('createdat', 'desc')
      .execute()) as FileRow[];

    return files.map(toFileRecord);
  },

  /**
   * Get a single file with ownership enforcement.
   */
  async getOwned(handle: DbHandle, fileId: string, userId: string): Promise<FileRecord | null> {
    const file = (await handle
      .selectFrom('app.files')
      .selectAll()
      .where('id', '=', fileId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst()) as FileRow | undefined;

    return file ? toFileRecord(file) : null;
  },

  /**
   * Get a file or throw NotFoundError.
   */
  async getOwnedOrThrow(handle: DbHandle, fileId: string, userId: string): Promise<FileRecord> {
    const file = await FileRepository.getOwned(handle, fileId, userId);
    if (!file) {
      throw new NotFoundError('File', { fileId });
    }
    return file;
  },

  /**
   * Get the URL for a file with ownership check.
   */
  async getUrl(handle: DbHandle, fileId: string, userId: string): Promise<string> {
    const file = (await handle
      .selectFrom('app.files')
      .select(['url'])
      .where('id', '=', fileId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst()) as { url: string } | undefined;

    if (!file) {
      throw new NotFoundError('File', { fileId });
    }

    return file.url;
  },

  /**
   * Check that a file exists for a given user (for deletion).
   */
  async existsForUser(handle: DbHandle, fileId: string, userId: string): Promise<boolean> {
    const file = (await handle
      .selectFrom('app.files')
      .select(['id'])
      .where('id', '=', fileId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst()) as { id: string } | undefined;

    return Boolean(file);
  },

  /**
   * Insert or update a file record (used after upload completion).
   */
  async upsert(handle: DbHandle, input: UpsertFileInput): Promise<FileRecord> {
    const now = new Date().toISOString();

    await handle
      .insertInto('app.files')
      .values({
        id: input.id,
        owner_userid: input.userId,
        storage_key: input.storageKey,
        original_name: input.originalName,
        mimetype: input.mimetype,
        size: input.size,
        url: input.url,
        content: input.content ?? null,
        text_content: input.textContent ?? null,
        metadata: (input.metadata ?? null) as JsonValue | null,
        createdat: now,
        updatedat: now,
      })
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          storage_key: input.storageKey,
          original_name: input.originalName,
          mimetype: input.mimetype,
          size: input.size,
          url: input.url,
          content: input.content ?? null,
          text_content: input.textContent ?? null,
          metadata: (input.metadata ?? null) as JsonValue | null,
          updatedat: now,
        }),
      )
      .execute();

    return FileRepository.getOwnedOrThrow(handle, input.id, input.userId);
  },

  /**
   * Delete a file record.
   */
  async delete(handle: DbHandle, fileId: string, userId: string): Promise<void> {
    await handle
      .deleteFrom('app.files')
      .where('id', '=', fileId)
      .where('owner_userid', '=', userId)
      .execute();
  },
};
