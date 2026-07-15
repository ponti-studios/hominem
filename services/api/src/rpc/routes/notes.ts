import { db, NoteRepository, VectorDocumentRepository } from '@hominem/db';
import { embeddingQueue } from '@hominem/queues';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { NoteService } from '../../application/notes.service';
import {
  CreateNoteInputSchema,
  NoteParamSchema,
  NotesListQuerySchema,
  NotesFeedQuerySchema,
  NoteSearchQuerySchema,
  UpdateNoteInputSchema,
} from '../../schemas/notes.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { toNoteDto, toNoteFeedItemDto } from './notes.mapper';
const noteService = new NoteService();

async function enqueueNoteEmbedding(userId: string, noteId: string) {
  await embeddingQueue.add(
    'generate-embedding',
    { jobId: `note-${noteId}`, userId, entityType: 'note' as const, entityId: noteId },
    { jobId: `note-${noteId}`, removeOnComplete: true, removeOnFail: false },
  );
}

export const notesRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', NotesListQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
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
    const userId = c.get('auth')!.userId;
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
  .get('/search', zValidator('query', NoteSearchQuerySchema), async (c) => {
    const userId = c.get('auth')!.userId;
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
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');
    const note = await noteService.createNote(userId, {
      title: input.title ?? null,
      content: input.content,
      ...(input.fileIds ? { fileIds: input.fileIds } : {}),
    });
    await enqueueNoteEmbedding(userId, note.id);

    return c.json(toNoteDto(note), 201);
  })
  .get('/:id', zValidator('param', NoteParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');
    const note = await NoteRepository.load(db, id, userId);
    return c.json(toNoteDto(note));
  })
  .patch(
    '/:id',
    zValidator('param', NoteParamSchema),
    zValidator('json', UpdateNoteInputSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      const note = await noteService.updateNote(id, userId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.fileIds ? { fileIds: input.fileIds } : {}),
      });
      await enqueueNoteEmbedding(userId, note.id);

      return c.json(toNoteDto(note));
    },
  )
  .delete('/:id', zValidator('param', NoteParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');

    const note = await NoteRepository.load(db, id, userId);
    await NoteRepository.hardDelete(db, { noteId: id, userId });
    await VectorDocumentRepository.deleteForEntity(db, 'note', id);

    return c.json(toNoteDto(note));
  });
