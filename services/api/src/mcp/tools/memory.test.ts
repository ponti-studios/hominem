import { db, pool } from '@hominem/db/core';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@hominem/queues', () => ({ embeddingQueue: { add: async () => undefined } }));

import './memory';
import { callTool } from '../tool-registry';

const userId = 'd4000000-0000-4000-8000-000000000001';

type RememberResult = {
  id: string;
  title: string | null;
  excerpt: string | null;
  createdAt: string;
};

function rememberResult(res: Awaited<ReturnType<typeof callTool>>): RememberResult {
  return res.structuredContent as RememberResult;
}

async function memoryCount(userId: string): Promise<number> {
  const { count } = await db
    .selectFrom('app.notes')
    .select(db.fn.countAll().as('count'))
    .where('ownerUserid', '=', userId)
    .where('kind', '=', 'memory')
    .executeTakeFirstOrThrow();
  return Number(count);
}

beforeEach(async () => {
  // Deleting the user cascades to every app.* row it owns, so each test starts clean.
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
    [userId, 'Test User', `${userId}@test.hominem.dev`, true],
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
});

describe('remember', () => {
  it('saves a fact as a memory note', async () => {
    const result = rememberResult(
      await callTool(userId, 'remember', {
        title: 'Cyndi',
        content: 'Cyndi is my dog',
      }),
    );

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.title).toBe('Cyndi');
    expect(await memoryCount(userId)).toBe(1);
  });

  it('returns the existing memory instead of duplicating identical content', async () => {
    const first = rememberResult(
      await callTool(userId, 'remember', {
        title: 'Kelsey',
        content: 'Kelsey is my girlfriend',
      }),
    );

    const duplicate = rememberResult(
      await callTool(userId, 'remember', {
        title: 'girlfriend',
        content: 'Kelsey is my girlfriend',
      }),
    );

    expect(duplicate.id).toBe(first.id);
    expect(await memoryCount(userId)).toBe(1);
  });

  it('saves distinct facts as separate memories', async () => {
    const before = await memoryCount(userId);

    const cyndi = rememberResult(
      await callTool(userId, 'remember', {
        title: 'Cyndi',
        content: 'Cyndi is my dog',
      }),
    );
    const kelsey = rememberResult(
      await callTool(userId, 'remember', {
        title: 'Kelsey',
        content: 'Kelsey is my girlfriend',
      }),
    );

    expect(cyndi.id).not.toBe(kelsey.id);
    expect(await memoryCount(userId)).toBe(before + 2);
  });
});
