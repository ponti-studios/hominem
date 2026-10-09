import { pool } from '@hominem/db/core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  listMemoriesPageOutputSchema,
  listMemoryStampsOutputSchema,
} from '../../schemas/memory.schema';
import { createRpcTestApp } from '../../testkit/rpc-test-app';
import type { RpcUser } from '../middleware/auth';
import { memoryRoutes } from './memory';

vi.mock('@hominem/queues', () => ({
  embeddingQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

const userId = 'a2000001-0000-4000-8000-0000000000a5';
const otherId = 'a2000001-0000-4000-8000-0000000000a6';
const makeUser = (id: string): RpcUser => ({
  id,
  email: `${id}@test.dev`,
  name: 'Memory Paging Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
});
const app = createRpcTestApp(memoryRoutes, { path: '/memory', user: makeUser(userId) });

// Three of these are made in the same millisecond, two of them microseconds apart, and one is
// newer than the rest: the cases a naive cursor drops.
const seeded = [
  { text: 'oldest', at: '2026-01-01T10:00:00.000100Z', updated: '2026-04-01T10:00:00Z' },
  { text: 'same-ms-a', at: '2026-02-01T10:00:00.000100Z', updated: '2026-02-01T10:00:00Z' },
  { text: 'same-ms-b', at: '2026-02-01T10:00:00.000900Z', updated: '2026-02-01T10:00:00Z' },
  { text: 'same-ms-c', at: '2026-02-01T10:00:00.000500Z', updated: '2026-02-01T10:00:00Z' },
  { text: 'newest', at: '2026-03-01T10:00:00.000000Z', updated: '2026-03-05T10:00:00Z' },
];

async function walk(limit: number): Promise<string[]> {
  const ids: string[] = [];
  let before: string | null = null;
  for (let guard = 0; guard < 20; guard++) {
    const query = before ? `?limit=${limit}&before=${before}` : `?limit=${limit}`;
    const res = await app.request(`/memory${query}`);
    expect(res.status).toBe(200);
    const page = listMemoriesPageOutputSchema.parse(await res.json());
    ids.push(...page.memories.map((m) => m.id));
    if (!page.next) return ids;
    before = page.next;
  }
  throw new Error('paging did not finish');
}

beforeAll(async () => {
  for (const id of [userId, otherId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, 'Memory Paging Test User', `${id}@test.dev`, true],
    );
  }
  await pool.query('DELETE FROM app.notes WHERE owner_userid = ANY($1)', [[userId, otherId]]);
  for (const row of seeded) {
    await pool.query(
      `INSERT INTO app.notes (owner_userid, kind, content, excerpt, createdat, updatedat) VALUES ($1, 'memory', $2, $2, $3, $4)`,
      [userId, row.text, row.at, row.updated],
    );
  }
  // Another person's memory and one of this person's ordinary notes must never appear.
  await pool.query(
    `INSERT INTO app.notes (owner_userid, kind, content, excerpt) VALUES ($1, 'memory', 'not mine', 'not mine')`,
    [otherId],
  );
  await pool.query(
    `INSERT INTO app.notes (owner_userid, kind, content, excerpt) VALUES ($1, 'note', 'a note', 'a note')`,
    [userId],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[userId, otherId]]);
});

describe('GET /memory paging', () => {
  it('returns everything newest first with no next cursor on the last page', async () => {
    const res = await app.request('/memory');
    const page = listMemoriesPageOutputSchema.parse(await res.json());
    const texts = page.memories.map((m) => m.content);
    expect(texts[0]).toBe('newest');
    expect(texts[4]).toBe('oldest');
    // Made in the same millisecond, so their order is the id order: stable, which is what the walks below rely on.
    expect(texts.slice(1, 4).sort()).toEqual(['same-ms-a', 'same-ms-b', 'same-ms-c']);
    expect(page.next).toBeNull();
    expect(Number.isNaN(Date.parse(page.serverTime))).toBe(false);
  });

  it.each([1, 2, 3, 4])(
    'walks the same list with pages of %i, none skipped or repeated',
    async (size) => {
      const whole = listMemoriesPageOutputSchema.parse(await (await app.request('/memory')).json());
      expect(await walk(size)).toEqual(whole.memories.map((m) => m.id));
    },
  );

  it('returns only memories updated since a time', async () => {
    const res = await app.request('/memory?since=2026-02-15T00:00:00Z');
    const page = listMemoriesPageOutputSchema.parse(await res.json());
    expect(page.memories.map((m) => m.content)).toEqual(['newest', 'oldest']);
  });

  it('rejects a limit over 100, a bad since, and a cursor it did not make', async () => {
    expect((await app.request('/memory?limit=101')).status).toBe(400);
    expect((await app.request('/memory?since=yesterday')).status).toBe(400);
    expect((await app.request('/memory?before=not-a-cursor')).status).toBe(400);
  });

  it('accepts up to 100 per page', async () => {
    expect((await app.request('/memory?limit=100')).status).toBe(200);
  });
});

describe('GET /memory/ids', () => {
  it('lists every memory id with its update time, and only this person’s memories', async () => {
    const res = await app.request('/memory/ids');
    expect(res.status).toBe(200);
    const body = listMemoryStampsOutputSchema.parse(await res.json());
    expect(body.memories).toHaveLength(seeded.length);
    const whole = listMemoriesPageOutputSchema.parse(await (await app.request('/memory')).json());
    expect(body.memories.map((m) => m.id).sort()).toEqual(whole.memories.map((m) => m.id).sort());
    expect(body.memories.find((m) => m.updatedAt.startsWith('2026-03-05'))).toBeDefined();
  });
});
