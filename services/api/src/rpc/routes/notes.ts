import { getDb, NoteRepository } from '@hominem/db';
import {
  CreateNoteInputSchema,
  NotesFeedQuerySchema,
  NotesListQuerySchema,
  UpdateNoteInputSchema,
} from '@hominem/rpc/schemas/notes.schema';
import type {
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
import { toNoteDto, toNoteFeedItemDto } from './notes.mapper';

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

    const notes = await NoteRepository.list(getDb(), {
      userId,
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
    const feed = await NoteRepository.listFeed(getDb(), {
      userId,
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

    const results = await NoteRepository.search(getDb(), {
      userId,
      query: query.query,
      limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });

    return c.json<NotesSearchOutput>(results);
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
    const note = await NoteRepository.load(getDb(), id, userId);
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

    const note = await NoteRepository.load(getDb(), id, userId);
    await NoteRepository.hardDelete(getDb(), id, userId);

    return c.json<NotesDeleteOutput>(toNoteDto(note));
  })
  .post('/:id/archive', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    const note = await NoteRepository.load(getDb(), id, userId);
    await NoteRepository.archive(getDb(), id, userId);
    return c.json(toNoteDto(note));
  })
  .post('/:id/unarchive', zValidator('param', noteParamSchema), async (c) => {
    const userId = c.get('userId')!;
    const { id } = c.req.valid('param');
    await NoteRepository.unarchive(getDb(), id, userId);
    const note = await NoteRepository.load(getDb(), id, userId);
    return c.json(toNoteDto(note));
  });
