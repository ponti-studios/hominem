import { isObject } from '@hominem/utils';
import { sql, type Selectable, type UpdateObject } from 'kysely';

import type { Database } from '../../db';
import { NotFoundError, ValidationError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppFiles, AppNotes } from '../../types/database';

type NoteRow = Selectable<AppNotes>;

type NoteFileSource = Pick<
  Selectable<AppFiles>,
  | 'id'
  | 'originalName'
  | 'mimetype'
  | 'size'
  | 'url'
  | 'content'
  | 'textContent'
  | 'metadata'
  | 'createdat'
>;

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

export type NoteKind = 'note' | 'memory';

const NOTE_KINDS: readonly NoteKind[] = ['note', 'memory'];

function parseNoteKind(value: string): NoteKind {
  const kind = NOTE_KINDS.find((candidate) => candidate === value);
  if (kind) return kind;
  throw new ValidationError(`Invalid note kind: ${value}`, { kind: value });
}

export interface NoteRecord {
  id: string;
  userId: string;
  kind: NoteKind;
  title: string | null;
  content: string;
  excerpt: string | null;
  files: NoteFileRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  userId: string;
  kind?: NoteKind;
  title: string | null;
  content: string;
  excerpt: string | null;
}

export interface UpdateNoteInput {
  title?: string | null;
  content?: string;
  excerpt?: string | null;
}

export interface NoteMutationCommand {
  noteId: string;
  userId: string;
}

export interface UpdateNoteCommand extends NoteMutationCommand {
  input: UpdateNoteInput;
}

export interface SyncNoteFilesCommand extends NoteMutationCommand {
  fileIds: string[];
}

export interface ListNotesInput {
  userId: string;
  limit?: number;
  offset?: number;
  since?: string;
  query?: string;
  kind?: NoteKind;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchNotesInput {
  userId: string;
  query: string;
  kind?: NoteKind;
  limit?: number;
  cursor?: string;
}

export interface GetOwnedNoteSummariesInput {
  userId: string;
  noteIds: string[];
  kind?: NoteKind;
}

export interface SearchNoteResult {
  id: string;
  title: string | null;
  excerpt: string | null;
}

export interface NoteContentRecord {
  id: string;
  title: string | null;
  excerpt: string | null;
  createdAt: string;
}

export interface ListNotesPageInput {
  userId: string;
  kind: NoteKind;
  limit?: number;
  /** An opaque cursor from the previous page's `next`. */
  before?: string;
  /** Only notes updated at or after this time. */
  since?: string;
}

export interface NotesPageRecord {
  notes: NoteRecord[];
  /** Cursor for the following page, or null on the last page. */
  next: string | null;
}

export interface NoteStamp {
  id: string;
  updatedAt: string;
}

export interface SearchNotesPageRecord {
  notes: SearchNoteResult[];
  nextCursor: string | null;
}

function toNoteFile(row: NoteFileSource): NoteFileRecord {
  return {
    id: row.id,
    originalName: row.originalName,
    mimetype: row.mimetype,
    size: row.size,
    url: row.url,
    uploadedAt: new Date(row.createdat).toISOString(),
    ...(row.content ? { content: row.content } : {}),
    ...(row.textContent ? { textContent: row.textContent } : {}),
    ...(isObject(row.metadata) ? { metadata: row.metadata } : {}),
  };
}

function toNoteRecord(row: NoteRow, files: NoteFileRecord[]): NoteRecord {
  return {
    id: row.id,
    userId: row.ownerUserid,
    kind: parseNoteKind(row.kind),
    title: row.title,
    content: row.content,
    excerpt: row.excerpt,
    files,
    createdAt: new Date(row.createdat).toISOString(),
    updatedAt: new Date(row.updatedat).toISOString(),
  };
}

function toNoteContentRecord(
  row: Pick<NoteRow, 'id' | 'title' | 'excerpt' | 'createdat'>,
): NoteContentRecord {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    createdAt: new Date(row.createdat).toISOString(),
  };
}

function encodeNoteSearchCursor(updatedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ updatedAt, id }), 'utf8').toString('base64url');
}

function decodeNoteSearchCursor(cursor: string): { updatedAt: string; id: string } | null {
  try {
    const parsed: { updatedAt?: unknown; id?: unknown } = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );

    if (typeof parsed.updatedAt !== 'string' || typeof parsed.id !== 'string') {
      return null;
    }

    return {
      updatedAt: parsed.updatedAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

// A list page is ordered newest first by creation time, then id. Postgres keeps microseconds but a
// JavaScript Date keeps milliseconds, so the order and the cursor both use the time cut to
// milliseconds. Otherwise two notes made in the same millisecond could be skipped between pages.
const createdAtMs = sql<string>`date_trunc('milliseconds', ${sql.ref('createdat')})`;

function encodePageCursor(createdAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt, id }), 'utf8').toString('base64url');
}

function decodePageCursor(cursor: string): { createdAt: string; id: string } {
  const bad = () => new ValidationError('Invalid cursor', { cursor });
  try {
    const parsed: { createdAt?: unknown; id?: unknown } = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (typeof parsed.createdAt !== 'string' || typeof parsed.id !== 'string') throw bad();
    if (Number.isNaN(Date.parse(parsed.createdAt))) throw bad();
    return { createdAt: new Date(parsed.createdAt).toISOString(), id: parsed.id };
  } catch (error) {
    throw error instanceof ValidationError ? error : bad();
  }
}

export const NoteRepository = {
  async getAttachedFiles(
    handle: DbHandle,
    noteIds: string[],
  ): Promise<Map<string, NoteFileRecord[]>> {
    if (noteIds.length === 0) {
      return new Map();
    }

    const rows = await handle
      .selectFrom('app.noteFiles as noteFile')
      .innerJoin('app.files as file', 'file.id', 'noteFile.fileId')
      .select([
        'noteFile.noteId as noteId',
        'file.id',
        'file.originalName',
        'file.mimetype',
        'file.size',
        'file.url',
        'file.content',
        'file.textContent',
        'file.metadata',
        'file.createdat',
      ])
      .where('noteFile.noteId', 'in', noteIds)
      .orderBy('noteFile.attachedAt', 'asc')
      .execute();

    const result = new Map<string, NoteFileRecord[]>();
    for (const row of rows) {
      const current = result.get(row.noteId) ?? [];
      current.push(toNoteFile(row));
      result.set(row.noteId, current);
    }
    return result;
  },

  async getOwned(handle: DbHandle, noteId: string, userId: string): Promise<NoteRow | null> {
    const note = await handle
      .selectFrom('app.notes')
      .selectAll()
      .where('id', '=', noteId)
      .where('ownerUserid', '=', userId)
      .executeTakeFirst();

    return note ?? null;
  },

  async getOwnedOrThrow(handle: DbHandle, noteId: string, userId: string): Promise<NoteRow> {
    const note = await NoteRepository.getOwned(handle, noteId, userId);
    if (!note) {
      throw new NotFoundError('Note', { noteId });
    }
    return note;
  },

  async findOwnedByContent(
    handle: DbHandle,
    input: { userId: string; kind?: NoteKind; content: string },
  ): Promise<NoteContentRecord | null> {
    let query = handle
      .selectFrom('app.notes')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .where('content', '=', input.content);

    if (input.kind) {
      query = query.where('kind', '=', input.kind);
    }

    const row = await query
      .select(['id', 'title', 'excerpt', 'createdat'])
      .orderBy('createdat', 'asc')
      .executeTakeFirst();
    return row ? toNoteContentRecord(row) : null;
  },

  async createMemoryIfAbsent(
    handle: DbHandle,
    input: { userId: string; title: string | null; content: string; excerpt: string | null },
  ): Promise<{ record: NoteRecord; created: boolean }> {
    const created = await handle
      .insertInto('app.notes')
      .values({
        ownerUserid: input.userId,
        kind: 'memory',
        title: input.title,
        content: input.content,
        excerpt: input.excerpt,
      })
      .onConflict((oc) =>
        oc.columns(['ownerUserid', 'kind', 'content']).where('kind', '=', 'memory').doNothing(),
      )
      .returningAll()
      .executeTakeFirst();

    if (created) return { record: toNoteRecord(created, []), created: true };

    const existing = await handle
      .selectFrom('app.notes')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .where('kind', '=', 'memory')
      .where('content', '=', input.content)
      .executeTakeFirst();
    if (!existing)
      throw new ValidationError('Memory insert conflicted but the existing memory was not found');
    return { record: toNoteRecord(existing, []), created: false };
  },

  async load(handle: DbHandle, noteId: string, userId: string): Promise<NoteRecord> {
    const note = await NoteRepository.getOwnedOrThrow(handle, noteId, userId);
    const attachedFiles = await NoteRepository.getAttachedFiles(handle, [note.id]);
    return toNoteRecord(note, attachedFiles.get(note.id) ?? []);
  },

  async list(handle: DbHandle, input: ListNotesInput): Promise<NoteRecord[]> {
    let query = handle.selectFrom('app.notes').selectAll().where('ownerUserid', '=', input.userId);

    if (input.since) {
      query = query.where('updatedat', '>=', new Date(input.since).toISOString());
    }

    if (input.kind) {
      query = query.where('kind', '=', input.kind);
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

    const rows = await query.limit(limit).offset(offset).execute();
    const attachedFiles = await NoteRepository.getAttachedFiles(
      handle,
      rows.map((r) => r.id),
    );

    return rows.map((row) => toNoteRecord(row, attachedFiles.get(row.id) ?? []));
  },

  async listPage(handle: DbHandle, input: ListNotesPageInput): Promise<NotesPageRecord> {
    const limit = Math.min(input.limit ?? 50, 100);
    const after = input.before ? decodePageCursor(input.before) : null;

    let query = handle
      .selectFrom('app.notes')
      .selectAll()
      .where('ownerUserid', '=', input.userId)
      .where('kind', '=', input.kind);

    if (input.since) {
      query = query.where('updatedat', '>=', new Date(input.since).toISOString());
    }

    if (after) {
      const { createdAt, id } = after;
      query = query.where((eb) =>
        eb.or([
          eb(createdAtMs, '<', createdAt),
          eb.and([eb(createdAtMs, '=', createdAt), eb('id', '<', id)]),
        ]),
      );
    }

    const rows = await query
      .orderBy(createdAtMs, 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .execute();

    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const attachedFiles = await NoteRepository.getAttachedFiles(
      handle,
      page.map((row) => row.id),
    );

    return {
      notes: page.map((row) => toNoteRecord(row, attachedFiles.get(row.id) ?? [])),
      next:
        rows.length > limit && last
          ? encodePageCursor(new Date(last.createdat).toISOString(), last.id)
          : null,
    };
  },

  /** Every id with its last update time, so a client can tell which of its copies were deleted. */
  async listStamps(
    handle: DbHandle,
    input: { userId: string; kind: NoteKind },
  ): Promise<NoteStamp[]> {
    const rows = await handle
      .selectFrom('app.notes')
      .select(['id', 'updatedat'])
      .where('ownerUserid', '=', input.userId)
      .where('kind', '=', input.kind)
      .orderBy('id', 'asc')
      .execute();
    return rows.map((row) => ({ id: row.id, updatedAt: new Date(row.updatedat).toISOString() }));
  },

  async search(handle: DbHandle, input: SearchNotesInput): Promise<SearchNotesPageRecord> {
    const limit = input.limit ? Math.min(input.limit, 20) : 10;
    const pattern = `%${input.query}%`;
    const decoded = input.cursor ? decodeNoteSearchCursor(input.cursor) : null;

    let query = handle
      .selectFrom('app.notes')
      .select(['id', 'title', 'excerpt', 'updatedat'])
      .where('ownerUserid', '=', input.userId)
      .where((eb) => eb.or([eb('title', 'ilike', pattern), eb('content', 'ilike', pattern)]));

    if (input.kind) query = query.where('kind', '=', input.kind);

    if (decoded) {
      query = query.where((eb) =>
        eb.or([
          eb('updatedat', '<', new Date(decoded.updatedAt).toISOString()),
          eb('updatedat', '=', new Date(decoded.updatedAt).toISOString()).and(
            'id',
            '<',
            decoded.id,
          ),
        ]),
      );
    }

    const rows = await query
      .orderBy('updatedat', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
      .execute();

    const notes = rows.slice(0, limit).map((note) => ({
      id: note.id,
      title: note.title,
      excerpt: note.excerpt,
    }));

    const lastRow = rows.at(limit - 1);

    return {
      notes,
      nextCursor:
        rows.length > limit && lastRow
          ? encodeNoteSearchCursor(new Date(lastRow.updatedat).toISOString(), lastRow.id)
          : null,
    };
  },

  async getOwnedSummariesByIds(
    handle: DbHandle,
    input: GetOwnedNoteSummariesInput,
  ): Promise<SearchNoteResult[]> {
    if (input.noteIds.length === 0) return [];
    let query = handle
      .selectFrom('app.notes')
      .select(['id', 'title', 'excerpt'])
      .where('ownerUserid', '=', input.userId)
      .where('id', 'in', input.noteIds);
    if (input.kind) query = query.where('kind', '=', input.kind);
    return query.execute();
  },

  async create(handle: DbHandle, input: CreateNoteInput): Promise<NoteRecord> {
    const created = await handle
      .insertInto('app.notes')
      .values({
        ownerUserid: input.userId,
        kind: input.kind ?? 'note',
        title: input.title,
        content: input.content,
        excerpt: input.excerpt,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toNoteRecord(created, []);
  },

  async update(handle: DbHandle, command: UpdateNoteCommand): Promise<void> {
    const sets: UpdateObject<Database, 'app.notes'> = {
      updatedat: new Date().toISOString(),
    };
    const input = command.input;
    if (input.title !== undefined) sets.title = input.title;
    if (input.content !== undefined) sets.content = input.content;
    if (input.excerpt !== undefined) sets.excerpt = input.excerpt;

    const updated = await handle
      .updateTable('app.notes')
      .set(sets)
      .where('id', '=', command.noteId)
      .where('ownerUserid', '=', command.userId)
      .returning('id')
      .executeTakeFirst();

    if (!updated) {
      throw new NotFoundError('Note', { noteId: command.noteId });
    }
  },

  async hardDelete(handle: DbHandle, command: NoteMutationCommand): Promise<void> {
    const deleted = await handle
      .deleteFrom('app.notes')
      .where('id', '=', command.noteId)
      .where('ownerUserid', '=', command.userId)
      .returning('id')
      .executeTakeFirst();

    if (!deleted) throw new NotFoundError('Note', { noteId: command.noteId });
  },

  // Needs to run inside a transaction — it validates file ownership then replaces the whole set
  async syncFiles(handle: DbHandle, command: SyncNoteFilesCommand): Promise<void> {
    await NoteRepository.getOwnedOrThrow(handle, command.noteId, command.userId);
    const uniqueFileIds = [...new Set(command.fileIds)];

    if (uniqueFileIds.length === 0) {
      await handle.deleteFrom('app.noteFiles').where('noteId', '=', command.noteId).execute();
      return;
    }

    const ownedFiles = await handle
      .selectFrom('app.files')
      .select('id')
      .where('ownerUserid', '=', command.userId)
      .where('id', 'in', uniqueFileIds)
      .execute();

    if (ownedFiles.length !== uniqueFileIds.length) {
      throw new ValidationError('One or more files are unavailable for this note');
    }

    await handle.deleteFrom('app.noteFiles').where('noteId', '=', command.noteId).execute();
    await handle
      .insertInto('app.noteFiles')
      .values(uniqueFileIds.map((fileId) => ({ noteId: command.noteId, fileId })))
      .execute();
  },
};
