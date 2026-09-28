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
import { callTool, type McpToolResult } from '../tool-registry';

const userId = 'a5000001-0000-4000-8000-000000000001';
const otherUserId = 'a5000001-0000-4000-8000-000000000002';
const DIMENSIONS = 1536;

type NoteResult = { id: string; title: string | null; content: string };

function unitVector(index: number): number[] {
  return Array.from({ length: DIMENSIONS }, (_, i) => (i === index ? 1 : 0));
}

function payload<T>(result: McpToolResult): T {
  return result.structuredContent as T;
}

async function createNote(owner: string, input: { title?: string; content: string }) {
  return payload<{ note: NoteResult }>(await callTool(owner, 'note_create', input)).note;
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

    const fetched = payload<{ note: NoteResult | null }>(
      await callTool(userId, 'note_get', { id: created.id }),
    );
    expect(fetched.note).toMatchObject({ id: created.id, content: 'oat milk, coffee' });

    const listed = payload<{ notes: Array<Record<string, unknown>> }>(
      await callTool(userId, 'note_list', {}),
    );
    expect(listed.notes.map((note) => note.id)).toEqual([created.id]);
    expect(listed.notes[0]).not.toHaveProperty('content');
  });

  it('filters the list by keyword', async () => {
    await createNote(userId, { title: 'Trip', content: 'book flights to Lisbon' });
    await createNote(userId, { title: 'Recipe', content: 'sourdough starter' });

    const listed = payload<{ notes: Array<{ title: string | null }> }>(
      await callTool(userId, 'note_list', { query: 'lisbon' }),
    );
    expect(listed.notes.map((note) => note.title)).toEqual(['Trip']);
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

    const listed = payload<{ notes: unknown[] }>(await callTool(userId, 'note_list', {}));
    expect(listed.notes).toEqual([]);

    const fetched = payload<{ note: unknown }>(
      await callTool(userId, 'note_get', { id: memory.id }),
    );
    expect(fetched.note).toBeNull();

    const updated = payload<{ note: unknown }>(
      await callTool(userId, 'note_update', { id: memory.id, content: 'changed' }),
    );
    expect(updated.note).toBeNull();

    const deleted = payload<{ removed: boolean }>(
      await callTool(userId, 'note_delete', { id: memory.id }),
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

    const updated = payload<{ note: NoteResult | null }>(
      await callTool(userId, 'note_update', { id: created.id, content: 'second pass' }),
    );
    expect(updated.note).toMatchObject({ title: 'Draft', content: 'second pass' });

    const cleared = payload<{ note: NoteResult | null }>(
      await callTool(userId, 'note_update', { id: created.id, title: null }),
    );
    expect(cleared.note?.title).toBeNull();
  });

  it('rejects an update with nothing to change', async () => {
    const created = await createNote(userId, { content: 'body' });
    await expect(callTool(userId, 'note_update', { id: created.id })).rejects.toThrow();
  });

  it("returns null for another user's note without touching it", async () => {
    const created = await createNote(userId, { content: 'private' });

    const result = payload<{ note: unknown }>(
      await callTool(otherUserId, 'note_update', { id: created.id, content: 'hijacked' }),
    );
    expect(result.note).toBeNull();

    const fetched = payload<{ note: NoteResult }>(
      await callTool(userId, 'note_get', { id: created.id }),
    );
    expect(fetched.note.content).toBe('private');
  });
});

describe('note_delete', () => {
  it('deletes a note and reports removed:false the second time', async () => {
    const created = await createNote(userId, { content: 'temporary' });

    expect(
      payload<{ removed: boolean }>(await callTool(userId, 'note_delete', { id: created.id })),
    ).toEqual({ removed: true });
    expect(
      payload<{ removed: boolean }>(await callTool(userId, 'note_delete', { id: created.id })),
    ).toEqual({ removed: false });
  });

  it("does not delete another user's note", async () => {
    const created = await createNote(userId, { content: 'mine' });

    expect(
      payload<{ removed: boolean }>(await callTool(otherUserId, 'note_delete', { id: created.id })),
    ).toEqual({ removed: false });
    expect(
      payload<{ note: unknown }>(await callTool(userId, 'note_get', { id: created.id })).note,
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

    const { results } = payload<{
      results: Array<{ id: string; title: string | null; similarity: number }>;
    }>(await callTool(userId, 'semantic_search', { query: 'something close' }));

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
      payload<{ results: unknown[] }>(await callTool(userId, 'semantic_search', { query: 'x' })),
    ).toEqual({ results: [] });
  });
});
