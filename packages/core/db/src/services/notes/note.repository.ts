import type { Selectable } from 'kysely';

import { NotFoundError, ValidationError } from '../../errors';
import type { DbHandle } from '../../transaction';
import { getDb } from '../../transaction';
import type { AppFiles, AppNoteFiles, AppNotes } from '../../types/database';
import { toIsoString, toRequiredIsoString } from '../_shared/mappers';

// ─── Row types ───────────────────────────────────────────────────────────────

type NoteRow = Selectable<AppNotes>;

type NoteFileSource = Pick<
  Selectable<AppFiles>,
  | 'id'
  | 'original_name'
  | 'mimetype'
  | 'size'
  | 'url'
  | 'content'
  | 'text_content'
  | 'metadata'
  | 'createdat'
>;

type AttachedFileRow = NoteFileSource & { noteId: string };

// ─── Domain output types ─────────────────────────────────────────────────────

export interface NoteFileRecord {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: string;
  content?: string;
  textContent?: string;
  metadata?: Record<string, unknown>;
}

export interface NoteRecord {
  id: string;
  userId: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  parentNoteId: string | null;
  files: NoteFileRecord[];
  createdAt: string;
  updatedAt: string;
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateNoteInput {
  userId: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  parentNoteId?: string | null;
}

export interface UpdateNoteInput {
  title?: string | null;
  content?: string;
  excerpt?: string | null;
}

export interface ListNotesInput {
  userId: string;
  limit?: number;
  offset?: number;
  since?: string;
  query?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface ListNoteFeedInput {
  userId: string;
  limit?: number;
  cursor?: string;
}

export interface SearchNotesInput {
  userId: string;
  query: string;
  limit?: number;
}

export interface NoteFeedRecord {
  id: string;
  title: string | null;
  contentPreview: string;
  createdAt: string;
  authorId: string;
  metadata: {
    hasAttachments: boolean;
  };
}

export interface NoteFeedPageRecord {
  notes: NoteFeedRecord[];
  nextCursor: string | null;
}

export interface SearchNoteResult {
  id: string;
  title: string | null;
  excerpt: string | null;
}

type NoteFeedRow = Pick<
  NoteRow,
  'id' | 'title' | 'excerpt' | 'content' | 'createdat' | 'owner_userid'
>;

type NoteFeedAttachmentRow = {
  noteId: string;
};

// ─── Mappers ─────────────────────────────────────────────────────────────────

function toNoteFile(row: NoteFileSource): NoteFileRecord {
  return {
    id: row.id,
    originalName: row.original_name,
    mimetype: row.mimetype,
    size: row.size,
    url: row.url,
    uploadedAt: toRequiredIsoString(row.createdat),
    ...(row.content ? { content: row.content } : {}),
    ...(row.text_content ? { textContent: row.text_content } : {}),
    ...(row.metadata && typeof row.metadata === 'object'
      ? { metadata: row.metadata as Record<string, unknown> }
      : {}),
  };
}

function toNoteRecord(row: NoteRow, files: NoteFileRecord[]): NoteRecord {
  return {
    id: row.id,
    userId: row.owner_userid,
    title: row.title,
    content: row.content,
    excerpt: row.excerpt,
    parentNoteId: row.parent_note_id,
    files,
    createdAt: toRequiredIsoString(row.createdat),
    updatedAt: toRequiredIsoString(row.updatedat),
  };
}

function encodeNoteFeedCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), 'utf8').toString('base64url');
}

function decodeNoteFeedCursor(cursor: string): { createdAt: string; id: string } | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt?: unknown;
      id?: unknown;
    };

    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function buildContentPreview(excerpt: string | null, content: string): string {
  const normalized = (excerpt ?? content).replace(/\s+/g, ' ').trim();
  return normalized.slice(0, 240);
}

// ─── Repository ──────────────────────────────────────────────────────────────

export const NoteRepository = {
  /**
   * Fetch attached files grouped by note ID.
   */
  async getAttachedFiles(
    handle: DbHandle,
    noteIds: string[],
  ): Promise<Map<string, NoteFileRecord[]>> {
    if (noteIds.length === 0) {
      return new Map();
    }

    const rows = (await handle
      .selectFrom('app.note_files as noteFile')
      .innerJoin('app.files as file', 'file.id', 'noteFile.file_id')
      .select([
        'noteFile.note_id as noteId',
        'file.id',
        'file.original_name',
        'file.mimetype',
        'file.size',
        'file.url',
        'file.content',
        'file.text_content',
        'file.metadata',
        'file.createdat',
      ])
      .where('noteFile.note_id', 'in', noteIds)
      .orderBy('noteFile.attached_at', 'asc')
      .execute()) as AttachedFileRow[];

    const result = new Map<string, NoteFileRecord[]>();
    for (const row of rows) {
      const current = result.get(row.noteId) ?? [];
      current.push(toNoteFile(row));
      result.set(row.noteId, current);
    }
    return result;
  },

  /**
   * Get a single note by ID, enforcing ownership.
   * Returns null if not found.
   */
  async getOwned(handle: DbHandle, noteId: string, userId: string): Promise<NoteRow | null> {
    const note = await handle
      .selectFrom('app.notes')
      .selectAll()
      .where('id', '=', noteId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    return (note as NoteRow | undefined) ?? null;
  },

  /**
   * Get a note by ID with ownership check. Throws NotFoundError if missing.
   */
  async getOwnedOrThrow(handle: DbHandle, noteId: string, userId: string): Promise<NoteRow> {
    const note = await NoteRepository.getOwned(handle, noteId, userId);
    if (!note) {
      throw new NotFoundError('Note', { noteId });
    }
    return note;
  },

  /**
   * Load a note with its attached files, ready for API response.
   */
  async load(handle: DbHandle, noteId: string, userId: string): Promise<NoteRecord> {
    const note = await NoteRepository.getOwnedOrThrow(handle, noteId, userId);
    const attachedFiles = await NoteRepository.getAttachedFiles(handle, [note.id]);
    return toNoteRecord(note, attachedFiles.get(note.id) ?? []);
  },

  /**
   * List notes for a user with filtering and sorting.
   */
  async list(handle: DbHandle, input: ListNotesInput): Promise<NoteRecord[]> {
    let query = handle.selectFrom('app.notes').selectAll().where('owner_userid', '=', input.userId);

    if (input.since) {
      query = query.where('updatedat', '>=', new Date(input.since));
    }

    if (input.query) {
      const pattern = `%${input.query.trim()}%`;
      query = query.where((eb) =>
        eb.or([
          eb('title', 'ilike', pattern),
          eb('content', 'ilike', pattern),
          eb('excerpt', 'ilike', pattern),
        ]),
      );
    }

    if (input.sortBy === 'title') {
      query = query.orderBy('title', input.sortOrder ?? 'asc');
    } else if (input.sortBy === 'createdAt') {
      query = query.orderBy('createdat', input.sortOrder ?? 'desc');
    } else {
      query = query.orderBy('updatedat', input.sortOrder ?? 'desc');
    }

    const limit = input.limit ? Math.min(input.limit, 100) : 50;
    const offset = input.offset ?? 0;

    const rows = (await query.limit(limit).offset(offset).execute()) as NoteRow[];
    const attachedFiles = await NoteRepository.getAttachedFiles(
      handle,
      rows.map((r) => r.id),
    );

    return rows.map((row) => toNoteRecord(row, attachedFiles.get(row.id) ?? []));
  },

  async listFeed(handle: DbHandle, input: ListNoteFeedInput): Promise<NoteFeedPageRecord> {
    const limit = input.limit ? Math.min(input.limit, 100) : 20;
    let query = handle
      .selectFrom('app.notes')
      .select(['id', 'title', 'excerpt', 'content', 'createdat', 'owner_userid'])
      .where('owner_userid', '=', input.userId)
      .orderBy('createdat', 'desc')
      .orderBy('id', 'desc');

    if (input.cursor) {
      const decoded = decodeNoteFeedCursor(input.cursor);

      if (!decoded) {
        throw new ValidationError('Invalid note feed cursor');
      }

      const cursorDate = new Date(decoded.createdAt);
      query = query.where((eb) =>
        eb.or([
          eb('createdat', '<', cursorDate),
          eb.and([eb('createdat', '=', cursorDate), eb('id', '<', decoded.id)]),
        ]),
      );
    }

    const rows = (await query.limit(limit + 1).execute()) as NoteFeedRow[];
    const pageRows = rows.slice(0, limit);

    const attachmentRows =
      pageRows.length === 0
        ? []
        : ((await handle
            .selectFrom('app.note_files')
            .select('note_id as noteId')
            .where(
              'note_id',
              'in',
              pageRows.map((row) => row.id),
            )
            .groupBy('note_id')
            .execute()) as NoteFeedAttachmentRow[]);
    const attachmentIds = new Set(attachmentRows.map((row) => row.noteId));

    const notes = pageRows.map<NoteFeedRecord>((row) => ({
      id: row.id,
      title: row.title,
      contentPreview: buildContentPreview(row.excerpt, row.content),
      createdAt: toRequiredIsoString(row.createdat),
      authorId: row.owner_userid,
      metadata: {
        hasAttachments: attachmentIds.has(row.id),
      },
    }));
    const lastRow = pageRows.at(-1);

    return {
      notes,
      nextCursor:
        rows.length > limit && lastRow
          ? encodeNoteFeedCursor(toRequiredIsoString(lastRow.createdat), lastRow.id)
          : null,
    };
  },

  /**
   * Search notes by title/content text match.
   */
  async search(handle: DbHandle, input: SearchNotesInput): Promise<SearchNoteResult[]> {
    const limit = input.limit ? Math.min(input.limit, 20) : 10;
    const pattern = `%${input.query}%`;

    const notes = (await handle
      .selectFrom('app.notes')
      .select(['id', 'title', 'excerpt'])
      .where('owner_userid', '=', input.userId)
      .where((eb) => eb.or([eb('title', 'ilike', pattern), eb('content', 'ilike', pattern)]))
      .orderBy('updatedat', 'desc')
      .limit(limit)
      .execute()) as Array<Pick<NoteRow, 'id' | 'title' | 'excerpt'>>;

    return notes.map((note) => ({
      id: note.id,
      title: note.title,
      excerpt: note.excerpt,
    }));
  },

  /**
   * Insert a new note.
   */
  async create(handle: DbHandle, input: CreateNoteInput): Promise<NoteRow> {
    return (await handle
      .insertInto('app.notes')
      .values({
        owner_userid: input.userId,
        title: input.title,
        content: input.content,
        excerpt: input.excerpt,
        ...(input.parentNoteId ? { parent_note_id: input.parentNoteId } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow()) as NoteRow;
  },

  /**
   * Update an existing note. Caller must verify ownership first.
   */
  async update(
    handle: DbHandle,
    noteId: string,
    userId: string,
    input: UpdateNoteInput,
  ): Promise<void> {
    const sets: Record<string, unknown> = {
      updatedat: new Date().toISOString(),
    };
    if (input.title !== undefined) sets.title = input.title;
    if (input.content !== undefined) sets.content = input.content;
    if (input.excerpt !== undefined) sets.excerpt = input.excerpt;

    await handle
      .updateTable('app.notes')
      .set(sets)
      .where('id', '=', noteId)
      .where('owner_userid', '=', userId)
      .executeTakeFirstOrThrow();
  },

  /**
   * Delete a note by ID with ownership enforcement.
   */
  async delete(handle: DbHandle, noteId: string, userId: string): Promise<void> {
    await handle
      .deleteFrom('app.notes')
      .where('id', '=', noteId)
      .where('owner_userid', '=', userId)
      .execute();
  },

  /**
   * Sync note-file attachments. Validates file ownership, then replaces all.
   * MUST be called inside a transaction for atomicity.
   */
  async syncFiles(
    handle: DbHandle,
    noteId: string,
    userId: string,
    fileIds: string[],
  ): Promise<void> {
    const uniqueFileIds = [...new Set(fileIds)];

    if (uniqueFileIds.length === 0) {
      await handle.deleteFrom('app.note_files').where('note_id', '=', noteId).execute();
      return;
    }

    const ownedFiles = (await handle
      .selectFrom('app.files')
      .select('id')
      .where('owner_userid', '=', userId)
      .where('id', 'in', uniqueFileIds)
      .execute()) as Array<{ id: string }>;

    if (ownedFiles.length !== uniqueFileIds.length) {
      throw new ValidationError('One or more files are unavailable for this note');
    }

    await handle.deleteFrom('app.note_files').where('note_id', '=', noteId).execute();
    await handle
      .insertInto('app.note_files')
      .values(uniqueFileIds.map((fileId) => ({ note_id: noteId, file_id: fileId })))
      .execute();
  },
};
