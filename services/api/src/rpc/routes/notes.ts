import { db, NoteRepository } from '@hominem/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { NoteService } from '../../application/notes.service';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { toNoteDto, toNoteFeedItemDto } from './notes.mapper';

const NoteContentTypeSchema = z.enum([
  'note',
  'document',
  'task',
  'timer',
  'journal',
  'tweet',
  'essay',
  'blog_post',
  'social_post',
]);
const CreateNoteInputSchema = z.object({
  type: NoteContentTypeSchema.default('note'),
  title: z.string().optional(),
  content: z.string(),
  fileIds: z.array(z.uuid()).max(5).optional(),
});

const UpdateNoteInputSchema = z.object({
  title: z.string().nullish(),
  content: z.string().optional(),
  fileIds: z.array(z.uuid()).max(5).optional(),
});

const NotesListQuerySchema = z.object({
  query: z.string().optional(),
  since: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

const NotesFeedQuerySchema = z.object({
  limit: z.string().optional(),
  cursor: z.string().optional(),
});

const noteParamSchema = z.object({ id: z.uuid() });
const noteSearchQuerySchema = z.object({
  query: z.string().trim().min(1),
  limit: z.string().optional(),
  cursor: z.string().optional(),
});
const noteService = new NoteService();

export const notesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', NotesListQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');

    const notes = await NoteRepository.list(db, {
      userId,
      ...(query.limit ? { limit: Number.parseInt(query.limit, 10) } : {}),
      ...(query.offset ? { offset: Number.parseInt(query.offset, 10) } : {}),
      ...(query.since ? { since: query.since } : {}),
      ...(query.query ? { query: query.query } : {}),
      ...(query.sortBy ? { sortBy: query.sortBy as 'createdAt' | 'updatedAt' | 'title' } : {}),
      ...(query.sortOrder ? { sortOrder: query.sortOrder as 'asc' | 'desc' } : {}),
    });

    return c.json({
      notes: notes.map(toNoteDto),
    });
  })
  .get('/feed', zValidator('query', NotesFeedQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const feed = await NoteRepository.listFeed(db, {
      userId,
      ...(query.limit ? { limit: Number.parseInt(query.limit, 10) } : {}),
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json({
      notes: feed.notes.map(toNoteFeedItemDto),
      nextCursor: feed.nextCursor,
    });
  })
  .get('/search', zValidator('query', noteSearchQuerySchema), async (c) => {
    const userId = c.get('userId')!;
    const query = c.req.valid('query');
    const limit = query.limit ? Math.min(Number.parseInt(query.limit, 10), 20) : 10;

    const results = await NoteRepository.search(db, {
      userId,
      query: query.query,
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json(results);
  })
  .post('/', zValidator('json', CreateNoteInputSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const note = await noteService.createNote(userId, {
      title: input.title ?? null,
      content: input.content,
      ...(input.fileIds ? { fileIds: input.fileIds } : {}),
    });

    return c.json(toNoteDto(note), 201);
  })
  .get('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await NoteRepository.load(db, id, userId);
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
        ...(input.fileIds ? { fileIds: input.fileIds } : {}),
      });

      return c.json(toNoteDto(note));
    },
  )
  .delete('/:id', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');

    const note = await NoteRepository.load(db, id, userId);
    await NoteRepository.hardDelete(db, id, userId);

    return c.json(toNoteDto(note));
  });
