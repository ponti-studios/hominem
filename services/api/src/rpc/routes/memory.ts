import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import { NoteRepository } from '@hominem/db/notes';
import { VectorDocumentRepository } from '@hominem/db/vector';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { rememberMemory } from '../../application/memory.service';
import { NoteService } from '../../application/notes.service';
import {
  listMemoriesPageInputSchema,
  MemoryParamSchema,
  rememberInputSchema,
  UpdateMemoryInputSchema,
} from '../../schemas/memory.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';

// Memories are just notes with kind = 'memory' — see mcp/tools/memory.ts
// for the AI-facing surface over these same rows.
const MEMORY_KIND = 'memory' as const;

const noteService = new NoteService();

function toMemoryDto(note: {
  id: string;
  title: string | null;
  content: string;
  excerpt: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    excerpt: note.excerpt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function assertOwnedMemory(id: string, userId: string) {
  const note = await NoteRepository.getOwnedOrThrow(db, id, userId);
  if (note.kind !== MEMORY_KIND) {
    throw new NotFoundError('Memory', { id });
  }
}

export const memoryRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', zValidator('query', listMemoriesPageInputSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { limit, before, since } = c.req.valid('query');
    // Taken before reading, so a client that asks for `since` this time next time cannot miss a
    // memory saved while this page was being read (it may see one twice, and merges by id).
    const serverTime = new Date().toISOString();
    const page = await NoteRepository.listPage(db, {
      userId,
      kind: MEMORY_KIND,
      limit: limit ?? 50,
      before,
      since,
    });
    return c.json({ memories: page.notes.map(toMemoryDto), next: page.next, serverTime });
  })
  // Every memory's id and last update time, so an app that keeps its own copy can drop the ones
  // deleted elsewhere.
  .get('/ids', async (c) => {
    const userId = c.get('auth')!.userId;
    const serverTime = new Date().toISOString();
    const memories = await NoteRepository.listStamps(db, { userId, kind: MEMORY_KIND });
    return c.json({ memories, serverTime });
  })
  .post('/', zValidator('json', rememberInputSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');

    const result = await rememberMemory(userId, input);
    return c.json(toMemoryDto(result.record), result.created ? 201 : 200);
  })
  .patch(
    '/:id',
    zValidator('param', MemoryParamSchema),
    zValidator('json', UpdateMemoryInputSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const { id } = c.req.valid('param');
      const input = c.req.valid('json');

      await assertOwnedMemory(id, userId);
      const note = await noteService.updateNote(id, userId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
      });
      // assertOwnedMemory just confirmed the row exists; null here means a concurrent delete.
      if (!note) throw new NotFoundError('Memory', { id });

      return c.json(toMemoryDto(note));
    },
  )
  .delete('/:id', zValidator('param', MemoryParamSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { id } = c.req.valid('param');

    await assertOwnedMemory(id, userId);
    const note = await NoteRepository.load(db, id, userId);
    await NoteRepository.hardDelete(db, { noteId: id, userId });
    await VectorDocumentRepository.deleteForEntity(db, 'note', id);

    return c.json(toMemoryDto(note));
  });
