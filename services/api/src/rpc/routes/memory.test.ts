import { pool } from '@hominem/db/core';
import { embeddingQueue } from '@hominem/queues';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createRpcTestApp, postJson } from '../../testkit/rpc-test-app';
import type { RpcUser } from '../middleware/auth';
import { memoryRoutes } from './memory';

vi.mock('@hominem/queues', () => ({
  embeddingQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));

const userId = 'a2000001-0000-4000-8000-0000000000a4';
const user: RpcUser = {
  id: userId,
  email: `${userId}@test.dev`,
  name: 'Memory Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const app = createRpcTestApp(memoryRoutes, { path: '/memory', user });

beforeAll(async () => {
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [userId, user.name, user.email, true],
  );
  await pool.query('DELETE FROM app.notes WHERE owner_userid = $1', [userId]);
});

afterAll(async () => {
  await pool.query('DELETE FROM "user" WHERE id = $1', [userId]);
});

describe('POST /memory', () => {
  it('creates a memory, returns an identical one as-is, and lists it', async () => {
    const content = 'Lives near the Thames and rows on Sundays.';

    const created = await postJson(app, '/memory', { content, title: 'Rowing' });
    expect(created.status).toBe(201);
    const memory = await created.json();
    expect(memory).toMatchObject({ title: 'Rowing', content });

    const again = await postJson(app, '/memory', { content, title: 'Rowing' });
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(memory.id);

    // A repeat call enqueues again (same jobId) so a failed first enqueue is repaired.
    expect(embeddingQueue.add).toHaveBeenCalledTimes(2);

    const list = await app.request('/memory?limit=5');
    expect(list.status).toBe(200);
    const { memories } = await list.json();
    expect(memories.map((m: { id: string }) => m.id)).toEqual([memory.id]);
  });

  it('rejects empty content', async () => {
    const res = await postJson(app, '/memory', { content: '   ' });
    expect(res.status).toBe(400);
  });
});
