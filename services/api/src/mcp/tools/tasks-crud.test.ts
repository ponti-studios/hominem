import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import './tasks';
import { callTool, type McpToolResult } from '../tool-registry';

const userId = 'a4000001-0000-4000-8000-000000000001';
const otherUserId = 'a4000001-0000-4000-8000-000000000002';

function resultContent(result: McpToolResult) {
  return result.structuredContent as Record<string, unknown>;
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      'INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
      [id, `Task CRUD Test User ${id}`, `${id}@test.hominem.dev`, true],
    );
  }
});

describe('task_create / task_list / task_detail', () => {
  it('round-trips create -> list -> detail', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', {
        title: 'Write the quarterly report',
        artifactType: 'task',
      }),
    ) as { task: { id: string; title: string } };
    expect(created.task).toMatchObject({ title: 'Write the quarterly report' });

    const listed = resultContent(await callTool(userId, 'task_list', {})) as {
      tasks: Array<{ id: string }>;
    };
    expect(listed.tasks.some((t) => t.id === created.task.id)).toBe(true);

    const detail = resultContent(
      await callTool(userId, 'task_detail', { id: created.task.id }),
    ) as { task: { id: string } | null; participants: unknown[]; children: unknown[] };
    expect(detail.task?.id).toBe(created.task.id);
    expect(detail.participants).toEqual([]);
    expect(detail.children).toEqual([]);

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });

  it('returns a null task detail for another user', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', {
        title: 'Private task',
        artifactType: 'task',
      }),
    ) as { task: { id: string } };

    const detail = resultContent(
      await callTool(otherUserId, 'task_detail', { id: created.task.id }),
    ) as { task: unknown };
    expect(detail.task).toBeNull();

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });
});

describe('task_create validation', () => {
  it('rejects creating a standalone task_list', async () => {
    await expect(
      callTool(userId, 'task_create', { title: 'Empty list', artifactType: 'task_list' }),
    ).rejects.toThrow();
  });
});

describe('task_list', () => {
  it('bounds the result to the requested limit', async () => {
    const created = await Promise.all(
      Array.from({ length: 3 }, (_, i) =>
        callTool(userId, 'task_create', { title: `Limit test ${i}`, artifactType: 'task' }),
      ),
    );

    const limited = resultContent(await callTool(userId, 'task_list', { limit: 1 })) as {
      tasks: unknown[];
    };
    expect(limited.tasks).toHaveLength(1);

    for (const result of created) {
      const { task } = resultContent(result) as { task: { id: string } };
      await db.deleteFrom('app.tasks').where('id', '=', task.id).execute();
    }
  });
});

describe('task_update', () => {
  it('updates a task', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Draft proposal', artifactType: 'task' }),
    ) as { task: { id: string } };

    const updated = resultContent(
      await callTool(userId, 'task_update', {
        id: created.task.id,
        data: { title: 'Draft final proposal', priority: 'high' },
      }),
    ) as { task: { title: string; priority: string } | null };
    expect(updated.task).toMatchObject({ title: 'Draft final proposal', priority: 'high' });

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });

  it('does not update another user’s task', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Guarded task', artifactType: 'task' }),
    ) as { task: { id: string } };

    const updated = resultContent(
      await callTool(otherUserId, 'task_update', {
        id: created.task.id,
        data: { title: 'Leaked title' },
      }),
    ) as { task: unknown };
    expect(updated.task).toBeNull();

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });

  it('replaces participants without touching any other field', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Assign me', artifactType: 'task' }),
    ) as { task: { id: string } };

    const person = await db
      .insertInto('app.people')
      .values({ ownerUserid: userId, displayName: 'Assignee' })
      .returning('id')
      .executeTakeFirstOrThrow();

    const updated = resultContent(
      await callTool(userId, 'task_update', {
        id: created.task.id,
        data: { participants: [person.id] },
      }),
    ) as { task: { title: string } | null };
    expect(updated.task).toMatchObject({ title: 'Assign me' });

    const detail = resultContent(
      await callTool(userId, 'task_detail', { id: created.task.id }),
    ) as { participants: Array<{ personId: string }> };
    expect(detail.participants).toHaveLength(1);
    expect(detail.participants[0]?.personId).toBe(person.id);

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
    await db.deleteFrom('app.people').where('id', '=', person.id).execute();
  });
});

describe('task_complete', () => {
  it('completes and reopens a task', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Ship the release', artifactType: 'task' }),
    ) as { task: { id: string } };

    const completed = resultContent(
      await callTool(userId, 'task_complete', { id: created.task.id, completed: true }),
    ) as { task: { status: string; completedAt: string | null } | null };
    expect(completed.task?.status).toBe('completed');
    expect(completed.task?.completedAt).not.toBeNull();

    const reopened = resultContent(
      await callTool(userId, 'task_complete', { id: created.task.id, completed: false }),
    ) as { task: { status: string; completedAt: string | null } | null };
    expect(reopened.task?.status).toBe('pending');
    expect(reopened.task?.completedAt).toBeNull();

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });

  it('does not complete another user’s task', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Guarded task', artifactType: 'task' }),
    ) as { task: { id: string } };

    const completed = resultContent(
      await callTool(otherUserId, 'task_complete', { id: created.task.id, completed: true }),
    ) as { task: unknown };
    expect(completed.task).toBeNull();

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });

  it('preserves task_list artifactType when completing a parent with children', async () => {
    const batch = resultContent(
      await callTool(userId, 'task_batch_create', {
        groups: [{ title: 'Trip prep', tasks: [{ title: 'Pack' }, { title: 'Book flight' }] }],
      }),
    ) as { groups: Array<{ parent: { id: string } }> };
    const parentId = batch.groups[0]?.parent.id as string;

    const completed = resultContent(
      await callTool(userId, 'task_complete', { id: parentId, completed: true }),
    ) as { task: { artifactType: string } | null };
    expect(completed.task?.artifactType).toBe('task_list');

    await db.deleteFrom('app.tasks').where('parentTaskId', '=', parentId).execute();
    await db.deleteFrom('app.tasks').where('id', '=', parentId).execute();
  });
});

describe('task_delete', () => {
  it('deletes a task', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Throwaway task', artifactType: 'task' }),
    ) as { task: { id: string } };

    const removed = resultContent(
      await callTool(userId, 'task_delete', { id: created.task.id }),
    ) as { removed: boolean };
    expect(removed.removed).toBe(true);

    const gone = await db
      .selectFrom('app.tasks')
      .select('id')
      .where('id', '=', created.task.id)
      .executeTakeFirst();
    expect(gone).toBeUndefined();
  });

  it('does not delete another user’s task', async () => {
    const created = resultContent(
      await callTool(userId, 'task_create', { title: 'Guarded task', artifactType: 'task' }),
    ) as { task: { id: string } };

    const removed = resultContent(
      await callTool(otherUserId, 'task_delete', { id: created.task.id }),
    ) as { removed: boolean };
    expect(removed.removed).toBe(false);

    const stillThere = await db
      .selectFrom('app.tasks')
      .select('id')
      .where('id', '=', created.task.id)
      .executeTakeFirst();
    expect(stillThere).toBeDefined();

    await db.deleteFrom('app.tasks').where('id', '=', created.task.id).execute();
  });
});

describe('task_batch_create', () => {
  it('creates a task list with subtasks', async () => {
    const created = resultContent(
      await callTool(userId, 'task_batch_create', {
        groups: [
          {
            title: 'Launch checklist',
            tasks: [{ title: 'Write docs' }, { title: 'Notify customers' }],
          },
        ],
      }),
    ) as { groups: Array<{ parent: { id: string }; tasks: Array<{ id: string }> }> };
    expect(created.groups).toHaveLength(1);
    const [group] = created.groups;
    expect(group.tasks).toHaveLength(2);

    const listed = resultContent(await callTool(userId, 'task_list', {})) as {
      tasks: Array<{ id: string; childCount: number }>;
    };
    const parent = listed.tasks.find((t) => t.id === group.parent.id);
    expect(parent?.childCount).toBe(2);

    const detail = resultContent(
      await callTool(userId, 'task_detail', { id: group.parent.id }),
    ) as { children: Array<{ id: string }> };
    expect(detail.children).toHaveLength(2);

    await db.deleteFrom('app.tasks').where('parentTaskId', '=', group.parent.id).execute();
    await db.deleteFrom('app.tasks').where('id', '=', group.parent.id).execute();
  });
});
