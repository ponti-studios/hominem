import { db, pool, sql } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, type McpToolResult } from '../tool-registry';
import './finance';

const userId = 'f20000d0-0000-4000-8000-000000000001';
const otherUserId = 'f20000d0-0000-4000-8000-000000000002';
const entityOne = 'f20000d1-0000-4000-8000-000000000001';
const entityTwo = 'f20000d1-0000-4000-8000-000000000002';

type TagResult = {
  assignmentsMoved?: number;
  tag?: { id: string; name: string } | null;
  reason?: string | null;
};

function content(res: McpToolResult<TagResult>): TagResult {
  return res.structuredContent ?? {};
}

async function createTag(ownerUserid: string, name: string): Promise<string> {
  const row = await db
    .insertInto('app.tags')
    .values({ ownerUserid, name, slug: name.toLowerCase(), path: name.toLowerCase() })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

async function assign(tagId: string, entityId: string) {
  await sql`
    INSERT INTO app.tag_assignments (tag_id, entity_table, entity_id, assignment_source)
    VALUES (${tagId}, 'app.notes'::regclass, ${entityId}, 'agent')
  `.execute(db);
}

async function activeAssignments(tagId: string): Promise<string[]> {
  const rows = await db
    .selectFrom('app.tagAssignments')
    .select('entityId')
    .where('tagId', '=', tagId)
    .where('removedAt', 'is', null)
    .execute();
  return rows.map((row) => row.entityId).sort();
}

async function tagById(id: string) {
  return db.selectFrom('app.tags').select(['id', 'name']).where('id', '=', id).executeTakeFirst();
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Tag User ${id}`, `${id}@test.hominem.dev`, true],
    );
    // Cascades to this user's tag assignments.
    await db.deleteFrom('app.tags').where('ownerUserid', '=', id).execute();
  }
});

describe('finance_tag_rename', () => {
  it('renames the display name, keeping the id and every assignment', async () => {
    const tagId = await createTag(userId, 'art');
    await assign(tagId, entityOne);
    await assign(tagId, entityTwo);

    const result = content(
      await callTool(userId, 'finance_tag_rename', { from: 'art', to: 'Art' }),
    );
    expect(result.reason).toBeNull();
    expect(result.tag).toEqual({ id: tagId, name: 'Art' });

    const row = await tagById(tagId);
    expect(row?.name).toBe('Art');
    expect(await activeAssignments(tagId)).toEqual([entityOne, entityTwo]);
  });

  it('refuses with target_exists when another tag already holds the name', async () => {
    const source = await createTag(userId, 'probe-source');
    await createTag(userId, 'probe-target');

    const result = content(
      await callTool(userId, 'finance_tag_rename', {
        from: 'probe-source',
        to: 'probe-target',
      }),
    );
    expect(result.reason).toBe('target_exists');
    expect((await tagById(source))?.name).toBe('probe-source');
  });

  it('reports an unknown source tag', async () => {
    const result = content(
      await callTool(userId, 'finance_tag_rename', { from: 'nope', to: 'Nope' }),
    );
    expect(result.reason).toBe('unknown_tag');
  });
});

describe('finance_tag_merge', () => {
  it('moves assignments, drops duplicates and removes the emptied tag', async () => {
    const source = await createTag(userId, 'merge-a');
    const target = await createTag(userId, 'merge-b');
    await assign(source, entityOne);
    await assign(source, entityTwo);
    await assign(target, entityOne); // shared entity — must not be duplicated

    const result = content(
      await callTool(userId, 'finance_tag_merge', { from: 'merge-a', into: 'merge-b' }),
    );
    expect(result.reason).toBeNull();
    expect(result.assignmentsMoved).toBe(1);
    expect(result.tag).toEqual({ id: target, name: 'merge-b' });

    expect(await tagById(source)).toBeUndefined();
    expect(await activeAssignments(target)).toEqual([entityOne, entityTwo]);
  });

  it('reports an unknown tag', async () => {
    await createTag(userId, 'merge-c');
    const result = content(
      await callTool(userId, 'finance_tag_merge', { from: 'merge-c', into: 'missing' }),
    );
    expect(result.reason).toBe('unknown_tag');
  });
});
