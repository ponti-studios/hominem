import { db } from '@hominem/db';
import type { AppFiles, AppNotes, Selectable } from '@hominem/db';
import {
  CreateNoteInputSchema,
  NotesListQuerySchema,
  UpdateNoteInputSchema,
} from '@hominem/rpc/schemas/notes.schema';
import type {
  Note,
  NoteFile,
  NotesSearchOutput,
  NotesDeleteOutput,
  NotesListOutput,
} from '@hominem/rpc/types/notes.types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

type NoteRow = Selectable<AppNotes>;
type FileRow = Selectable<AppFiles>;
type NoteFileSource = Pick<
  FileRow,
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

const noteParamSchema = z.object({ id: z.uuid() });
const noteSearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.string().optional(),
});

function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

function deriveTitle(title: string | null | undefined, content: string): string | null {
  if (title !== undefined) {
    const trimmedTitle = title?.trim() ?? '';
    return trimmedTitle.length > 0 ? trimmedTitle : null;
  }

  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 120) : null;
}

function deriveExcerpt(excerpt: string | null | undefined, content: string): string | null {
  if (excerpt !== undefined) {
    const trimmedExcerpt = excerpt?.trim() ?? '';
    return trimmedExcerpt.length > 0 ? trimmedExcerpt : null;
  }

  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized.slice(0, 240) : null;
}

function toNoteFile(row: NoteFileSource): NoteFile {
  return {
    id: row.id,
    originalName: row.original_name,
    mimetype: row.mimetype,
    size: row.size,
    url: row.url,
    uploadedAt: toIsoString(row.createdat) ?? new Date().toISOString(),
    ...(row.content ? { content: row.content } : {}),
    ...(row.text_content ? { textContent: row.text_content } : {}),
    ...(row.metadata && typeof row.metadata === 'object'
      ? { metadata: row.metadata as Record<string, unknown> }
      : {}),
  };
}

function toNote(row: NoteRow, files: NoteFile[]): Note {
  return {
    id: row.id,
    userId: row.owner_userid,
    type: 'note',
    status: 'draft',
    title: row.title,
    content: row.content,
    excerpt: row.excerpt,
    tags: [],
    mentions: [],
    analysis: null,
    publishingMetadata: null,
    parentNoteId: row.parent_note_id,
    files,
    versionNumber: 1,
    isLatestVersion: true,
    publishedAt: null,
    scheduledFor: null,
    createdAt: toIsoString(row.createdat) ?? new Date().toISOString(),
    updatedAt: toIsoString(row.updatedat) ?? new Date().toISOString(),
  };
}

async function getAttachedFiles(noteIds: string[]): Promise<Map<string, NoteFile[]>> {
  if (noteIds.length === 0) {
    return new Map();
  }

  const rows = (await db
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

  const attachedFiles = new Map<string, NoteFile[]>();

  for (const row of rows) {
    const current = attachedFiles.get(row.noteId) ?? [];
    current.push(toNoteFile(row));
    attachedFiles.set(row.noteId, current);
  }

  return attachedFiles;
}

async function getOwnedNote(noteId: string, userId: string): Promise<NoteRow> {
  const note = (await db
    .selectFrom('app.notes')
    .selectAll()
    .where('id', '=', noteId)
    .where('owner_userid', '=', userId)
    .executeTakeFirst()) as NoteRow | undefined;

  if (!note) {
    throw new NotFoundError('Note');
  }

  return note;
}

async function syncNoteFiles(noteId: string, userId: string, fileIds: string[]) {
  const uniqueFileIds = [...new Set(fileIds)];

  if (uniqueFileIds.length === 0) {
    await db.deleteFrom('app.note_files').where('note_id', '=', noteId).execute();
    return;
  }

  const ownedFiles = (await db
    .selectFrom('app.files')
    .select('id')
    .where('owner_userid', '=', userId)
    .where('id', 'in', uniqueFileIds)
    .execute()) as Array<{ id: string }>;

  if (ownedFiles.length !== uniqueFileIds.length) {
    throw new ValidationError('One or more files are unavailable for this note');
  }

  await db.deleteFrom('app.note_files').where('note_id', '=', noteId).execute();
  await db
    .insertInto('app.note_files')
    .values(uniqueFileIds.map((fileId) => ({ note_id: noteId, file_id: fileId })))
    .execute();
}

async function loadNote(noteId: string, userId: string): Promise<Note> {
  const note = await getOwnedNote(noteId, userId);
  const attachedFiles = await getAttachedFiles([note.id]);
  return toNote(note, attachedFiles.get(note.id) ?? []);
}

export const notesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', NotesListQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 100) : 50;
    const offset = query.offset ? Number.parseInt(query.offset, 10) : 0;

    let notesQuery = db.selectFrom('app.notes').selectAll().where('owner_userid', '=', userId);

    if (query.since) {
      notesQuery = notesQuery.where('updatedat', '>=', new Date(query.since));
    }

    if (query.query) {
      const pattern = `%${query.query.trim()}%`;
      notesQuery = notesQuery.where((eb) =>
        eb.or([
          eb('title', 'ilike', pattern),
          eb('content', 'ilike', pattern),
          eb('excerpt', 'ilike', pattern),
        ]),
      );
    }

    if (query.sortBy === 'title') {
      notesQuery = notesQuery.orderBy('title', query.sortOrder ?? 'asc');
    } else if (query.sortBy === 'createdAt') {
      notesQuery = notesQuery.orderBy('createdat', query.sortOrder ?? 'desc');
    } else {
      notesQuery = notesQuery.orderBy('updatedat', query.sortOrder ?? 'desc');
    }

    const rows = (await notesQuery.limit(limit).offset(offset).execute()) as NoteRow[];
    const attachedFiles = await getAttachedFiles(rows.map((row) => row.id));

    return c.json<NotesListOutput>({
      notes: rows.map((row) => toNote(row, attachedFiles.get(row.id) ?? [])),
    });
  })
  .get('/search', zValidator('query', noteSearchQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 20) : 10;
    const pattern = `%${query.query}%`;

    const notes = (await db
      .selectFrom('app.notes')
      .select(['id', 'title', 'excerpt'])
      .where('owner_userid', '=', userId)
      .where((eb) => eb.or([eb('title', 'ilike', pattern), eb('content', 'ilike', pattern)]))
      .orderBy('updatedat', 'desc')
      .limit(limit)
      .execute()) as Array<Pick<NoteRow, 'id' | 'title' | 'excerpt'>>;

    return c.json<NotesSearchOutput>({
      notes: notes.map((note) => ({
        id: note.id,
        title: note.title,
        excerpt: note.excerpt,
      })),
    });
  })
  .post('/', zValidator('json', CreateNoteInputSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const content = input.content.trim();
    const title = deriveTitle(input.title, content);
    const excerpt = deriveExcerpt(input.excerpt, content);

    const created = (await db
      .insertInto('app.notes')
      .values({
        owner_userid: userId,
        title,
        content,
        excerpt,
      })
      .returningAll()
      .executeTakeFirstOrThrow()) as NoteRow;

    await syncNoteFiles(created.id, userId, input.fileIds ?? []);

    return c.json(await loadNote(created.id, userId), 201);
  })
  .get('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    return c.json(await loadNote(id, userId));
  })
  .patch(
    '/:id',
    zValidator('param', noteParamSchema),
    zValidator('json', UpdateNoteInputSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');
      const existing = await getOwnedNote(id, userId);

      const nextContent = input.content !== undefined ? input.content.trim() : existing.content;
      const nextTitle = deriveTitle(input.title, nextContent) ?? existing.title;
      const nextExcerpt =
        input.excerpt !== undefined
          ? deriveExcerpt(input.excerpt, nextContent)
          : deriveExcerpt(existing.excerpt, nextContent);

      await db
        .updateTable('app.notes')
        .set({
          title: nextTitle,
          content: nextContent,
          excerpt: nextExcerpt,
          updatedat: new Date().toISOString(),
        })
        .where('id', '=', id)
        .where('owner_userid', '=', userId)
        .executeTakeFirstOrThrow();

      if (input.fileIds) {
        await syncNoteFiles(id, userId, input.fileIds);
      }

      return c.json(await loadNote(id, userId));
    },
  )
  .delete('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await loadNote(id, userId);

    await db
      .deleteFrom('app.notes')
      .where('id', '=', id)
      .where('owner_userid', '=', userId)
      .execute();

    return c.json<NotesDeleteOutput>(note);
  })
  .post('/:id/archive', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await loadNote(id, userId);

    if (!note) {
      throw new ForbiddenError('Note not found or access denied');
    }

    return c.json(note);
  });
