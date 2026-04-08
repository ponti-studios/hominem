import type { NoteRecord } from '@hominem/db';
import {
  CreateNoteInputSchema,
  NotesFeedQuerySchema,
  NotesListQuerySchema,
  UpdateNoteInputSchema,
} from '@hominem/rpc/schemas/notes.schema';
import type {
  NoteFeedItem,
  Note,
  NoteFile,
  NotesDeleteOutput,
  NotesFeedOutput,
  NotesListOutput,
  NotesSearchOutput,
} from '@hominem/rpc/types/notes.types';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { NoteService } from '../../application/notes.service';
import { authMiddleware, type AppContext } from '../middleware/auth';

const noteParamSchema = z.object({ id: z.uuid() });
const noteSearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.string().optional(),
});
const noteService = new NoteService();

// ─── DTO mappers (application record → RPC wire type) ───────────────────────

function toNoteDto(record: NoteRecord): Note {
  return {
    id: record.id,
    userId: record.userId,
    type: 'note',
    status: 'draft',
    title: record.title,
    content: record.content,
    excerpt: record.excerpt,
    tags: [],
    mentions: [],
    analysis: null,
    publishingMetadata: null,
    parentNoteId: record.parentNoteId,
    files: record.files.map(
      (f): NoteFile => ({
        id: f.id,
        originalName: f.originalName,
        mimetype: f.mimetype,
        size: f.size,
        url: f.url,
        uploadedAt: f.uploadedAt,
        ...(f.content ? { content: f.content } : {}),
        ...(f.textContent ? { textContent: f.textContent } : {}),
        ...(f.metadata ? { metadata: f.metadata } : {}),
      }),
    ),
    versionNumber: 1,
    isLatestVersion: true,
    publishedAt: null,
    scheduledFor: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toNoteFeedItemDto(record: {
  id: string;
  title: string | null;
  contentPreview: string;
  createdAt: string;
  authorId: string;
  metadata: { hasAttachments: boolean };
}): NoteFeedItem {
  return {
    id: record.id,
    title: record.title,
    contentPreview: record.contentPreview,
    createdAt: record.createdAt,
    authorId: record.authorId,
    metadata: {
      hasAttachments: record.metadata.hasAttachments,
    },
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export const notesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', NotesListQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');

    const notes = await noteService.listNotes(userId, {
      ...(query.limit ? { limit: Number.parseInt(query.limit, 10) } : {}),
      ...(query.offset ? { offset: Number.parseInt(query.offset, 10) } : {}),
      ...(query.since ? { since: query.since } : {}),
      ...(query.query ? { query: query.query } : {}),
      ...(query.sortBy ? { sortBy: query.sortBy as 'createdAt' | 'updatedAt' | 'title' } : {}),
      ...(query.sortOrder ? { sortOrder: query.sortOrder as 'asc' | 'desc' } : {}),
    });

    return c.json<NotesListOutput>({
      notes: notes.map(toNoteDto),
    });
  })
  .get('/feed', zValidator('query', NotesFeedQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const feed = await noteService.listNoteFeed(userId, {
      ...(query.limit ? { limit: Number.parseInt(query.limit, 10) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json<NotesFeedOutput>({
      notes: feed.notes.map(toNoteFeedItemDto),
      nextCursor: feed.nextCursor,
    });
  })
  .get('/search', zValidator('query', noteSearchQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 20) : 10;

    const results = await noteService.searchNotes(userId, query.query, limit);

    return c.json<NotesSearchOutput>({ notes: results });
  })
  .post('/', zValidator('json', CreateNoteInputSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const note = await noteService.createNote(userId, {
      title: input.title ?? null,
      content: input.content,
      excerpt: input.excerpt ?? null,
      ...(input.fileIds ? { fileIds: input.fileIds } : {}),
    });

    return c.json(toNoteDto(note), 201);
  })
  .get('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await noteService.getNote(id, userId);
    return c.json(toNoteDto(note));
  })
  .patch(
    '/:id',
    zValidator('param', noteParamSchema),
    zValidator('json', UpdateNoteInputSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      const note = await noteService.updateNote(id, userId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
        ...(input.fileIds ? { fileIds: input.fileIds } : {}),
      });

      return c.json(toNoteDto(note));
    },
  )
  .delete('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');

    const note = await noteService.deleteNote(id, userId);

    return c.json<NotesDeleteOutput>(toNoteDto(note));
  })
  .post('/:id/archive', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await noteService.archiveNote(id, userId);
    return c.json(toNoteDto(note));
  });
