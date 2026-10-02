import { db, pool } from '@hominem/db/core';
import { VectorDocumentRepository } from '@hominem/db/vector';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ generateEmbedding: vi.fn() }));

vi.mock('@hominem/queues', () => ({ embeddingQueue: { add: async () => undefined } }));
vi.mock('@hominem/ai', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@hominem/ai')>()),
  generateEmbedding: mocks.generateEmbedding,
  assertUnderMonthlyUsageLimit: async () => undefined,
  recordAIUsageEvent: async () => undefined,
}));

import './notes';
import { NoteService } from '../../application/notes.service';
import {
  noteCreateToolOutputSchema,
  noteDeleteToolOutputSchema,
  noteGetToolOutputSchema,
  noteListToolOutputSchema,
  noteUpdateToolOutputSchema,
  semanticSearchOutputSchema,
} from '../../schemas/notes.schema';
import { toolOutput } from '../../testkit/tool-result';
import { callTool } from '../tool-registry';

const userId = 'a5000001-0000-4000-8000-000000000001';
const otherUserId = 'a5000001-0000-4000-8000-000000000002';
const DIMENSIONS = 1536;

function unitVector(index: number): number[] {
  return Array.from({ length: DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

async function createNote(owner: string, input: { title?: string; content: string }) {
  return toolOutput(await callTool(owner, 'note_create', input), noteCreateToolOutputSchema).note;
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [id, `Notes Test User ${id}`, `${id}@test.hominem.dev`, true],
    );
  }
});

beforeEach(async () => {
  await db.deleteFrom('app.notes').where('ownerUserid', 'in', [userId, otherUserId]).execute();
});

afterAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
});

describe('note_create / note_get / note_list', () => {
  it('round-trips create -> get -> list', async () => {
    const created = await createNote(userId, { title: 'Groceries', content: 'oat milk, coffee' });
    expect(created).toMatchObject({ title: 'Groceries', content: 'oat milk, coffee' });

    const fetched = toolOutput(
      await callTool(userId, 'note_get', { id: created.id }),
      noteGetToolOutputSchema,
    );
    expect(fetched.note).toMatchObject({ id: created.id, content: 'oat milk, coffee' });

    const listed = toolOutput(await callTool(userId, 'note_list', {}), noteListToolOutputSchema);
    expect(listed.notes.map((note) => note.id)).toEqual([created.id]);
    expect(listed.notes[0]).not.toHaveProperty('content');
  });

  it("never returns another user's note", async () => {
    const created = await createNote(userId, { title: 'Private', content: 'do not share' });

    const asOther = toolOutput(
      await callTool(otherUserId, 'note_get', { id: created.id }),
      noteGetToolOutputSchema,
    );
    expect(asOther.note).toBeNull();
  });

  it('filters the list by keyword', async () => {
    await createNote(userId, { title: 'Trip', content: 'book flights to Lisbon' });
    await createNote(userId, { title: 'Recipe', content: 'sourdough starter' });

    const listed = toolOutput(
      await callTool(userId, 'note_list', { query: 'lisbon' }),
      noteListToolOutputSchema,
    );
    expect(listed.notes.map((note) => note.title)).toEqual(['Trip']);
  });

  it('searches only note-kind rows and returns null for a missing owned note', async () => {
    const note = await createNote(userId, { title: 'Shared topic', content: 'shared phrase' });
    await db
      .insertInto('app.notes')
      .values({
        ownerUserid: userId,
        kind: 'memory',
        title: 'Memory topic',
        content: 'shared phrase from memory',
        excerpt: 'shared phrase from memory',
      })
      .execute();

    const service = new NoteService();
    const result = await service.searchNotes(userId, { query: 'shared phrase' });
    expect(result.notes.map((resultNote) => resultNote.id)).toEqual([note.id]);
    expect(await service.getOwnedNote(userId, '99999999-9999-4999-8999-999999999999')).toBeNull();
  });
});

describe('note tools and memories', () => {
  it('excludes kind=memory notes from list and get', async () => {
    const memory = await db
      .insertInto('app.notes')
      .values({
        ownerUserid: userId,
        kind: 'memory',
        title: 'Seat preference',
        content: 'Prefers window seats',
        excerpt: 'Prefers window seats',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const listed = toolOutput(await callTool(userId, 'note_list', {}), noteListToolOutputSchema);
    expect(listed.notes).toEqual([]);

    const fetched = toolOutput(
      await callTool(userId, 'note_get', { id: memory.id }),
      noteGetToolOutputSchema,
    );
    expect(fetched.note).toBeNull();

    const updated = toolOutput(
      await callTool(userId, 'note_update', { id: memory.id, content: 'changed' }),
      noteUpdateToolOutputSchema,
    );
    expect(updated.note).toBeNull();

    const deleted = toolOutput(
      await callTool(userId, 'note_delete', { id: memory.id }),
      noteDeleteToolOutputSchema,
    );
    expect(deleted.removed).toBe(false);
    const stillThere = await db
      .selectFrom('app.notes')
      .select('content')
      .where('id', '=', memory.id)
      .executeTakeFirst();
    expect(stillThere?.content).toBe('Prefers window seats');
  });
});

describe('note_update', () => {
  it('updates title and content and clears a title with null', async () => {
    const created = await createNote(userId, { title: 'Draft', content: 'first pass' });

    const updated = toolOutput(
      await callTool(userId, 'note_update', { id: created.id, content: 'second pass' }),
      noteUpdateToolOutputSchema,
    );
    expect(updated.note).toMatchObject({ title: 'Draft', content: 'second pass' });

    const cleared = toolOutput(
      await callTool(userId, 'note_update', { id: created.id, title: null }),
      noteUpdateToolOutputSchema,
    );
    expect(cleared.note?.title).toBeNull();
  });

  it('rejects an update with nothing to change', async () => {
    const created = await createNote(userId, { content: 'body' });
    await expect(callTool(userId, 'note_update', { id: created.id })).rejects.toThrow();
  });

  it("returns null for another user's note without touching it", async () => {
    const created = await createNote(userId, { content: 'private' });

    const result = toolOutput(
      await callTool(otherUserId, 'note_update', { id: created.id, content: 'hijacked' }),
      noteUpdateToolOutputSchema,
    );
    expect(result.note).toBeNull();

    const fetched = toolOutput(
      await callTool(userId, 'note_get', { id: created.id }),
      noteGetToolOutputSchema,
    );
    expect(fetched.note?.content).toBe('private');
  });
});

describe('note_delete', () => {
  it('deletes a note and reports removed:false the second time', async () => {
    const created = await createNote(userId, { content: 'temporary' });

    expect(
      toolOutput(
        await callTool(userId, 'note_delete', { id: created.id }),
        noteDeleteToolOutputSchema,
      ),
    ).toEqual({ removed: true });
    expect(
      toolOutput(
        await callTool(userId, 'note_delete', { id: created.id }),
        noteDeleteToolOutputSchema,
      ),
    ).toEqual({ removed: false });
  });

  it("does not delete another user's note", async () => {
    const created = await createNote(userId, { content: 'mine' });

    expect(
      toolOutput(
        await callTool(otherUserId, 'note_delete', { id: created.id }),
        noteDeleteToolOutputSchema,
      ),
    ).toEqual({ removed: false });
    expect(
      toolOutput(await callTool(userId, 'note_get', { id: created.id }), noteGetToolOutputSchema)
        .note,
    ).not.toBeNull();
  });
});

describe('semantic_search', () => {
  beforeEach(async () => {
    mocks.generateEmbedding.mockReset();
    mocks.generateEmbedding.mockResolvedValue({ embedding: unitVector(0), usage: null });
  });

  async function index(owner: string, noteId: string, vectorIndex: number) {
    await VectorDocumentRepository.upsert(db, {
      ownerUserId: owner,
      entityType: 'note',
      entityId: noteId,
      content: 'indexed',
      embedding: unitVector(vectorIndex),
    });
  }

  it('ranks notes by similarity and skips memories and other users', async () => {
    const close = await createNote(userId, { title: 'Close', content: 'nearest' });
    const far = await createNote(userId, { title: 'Far', content: 'unrelated' });
    const foreign = await createNote(otherUserId, { title: 'Foreign', content: 'not yours' });
    const memory = await db
      .insertInto('app.notes')
      .values({
        ownerUserid: userId,
        kind: 'memory',
        title: 'Memory',
        content: 'a fact',
        excerpt: 'a fact',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await index(userId, close.id, 0);
    await index(userId, far.id, 1);
    await index(otherUserId, foreign.id, 0);
    await index(userId, memory.id, 0);

    const { results } = toolOutput(
      await callTool(userId, 'semantic_search', { query: 'something close' }),
      semanticSearchOutputSchema,
    );

    expect(results.map((result) => result.id)).toEqual([close.id, far.id]);
    expect(results[0]?.similarity).toBeGreaterThan(results[1]?.similarity ?? 1);
    expect(mocks.generateEmbedding).toHaveBeenCalledWith(
      'something close',
      expect.objectContaining({ inputType: 'search_query' }),
    );
  });

  it('returns nothing when the provider yields no embedding', async () => {
    mocks.generateEmbedding.mockResolvedValue({ embedding: [], usage: null });

    expect(
      toolOutput(
        await callTool(userId, 'semantic_search', { query: 'x' }),
        semanticSearchOutputSchema,
      ),
    ).toEqual({ results: [] });
  });

  it('finds a note past 20 closer memories in a single vector search query', async () => {
    const note = await createNote(userId, { title: 'Buried', content: 'the actual note' });
    await index(userId, note.id, 20);

    for (let i = 0; i < 20; i++) {
      const memory = await db
        .insertInto('app.notes')
        .values({
          ownerUserid: userId,
          kind: 'memory',
          title: `Memory ${i}`,
          content: `fact ${i}`,
          excerpt: `fact ${i}`,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await index(userId, memory.id, i);
    }

    const searchSpy = vi.spyOn(VectorDocumentRepository, 'search');

    const { results } = toolOutput(
      await callTool(userId, 'semantic_search', { query: 'find the note' }),
      semanticSearchOutputSchema,
    );

    expect(results.map((result) => result.id)).toEqual([note.id]);
    expect(searchSpy).toHaveBeenCalledTimes(1);
    searchSpy.mockRestore();
  });
});
