import { pool } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  completeTask,
  createTask,
  deleteTask,
  getTaskDetail,
  listTaskChanges,
  listTasks,
  updateTask,
} from './task.service';

const userId = 'd3000002-0000-4000-8000-000000000001';
const otherUserId = 'd3000002-0000-4000-8000-000000000002';

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4)`,
      [id, 'Task Sync Test User', `${id}@test.hominem.dev`, true],
    );
  }
});

afterAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(`DELETE FROM "user" WHERE id = $1`, [id]);
  }
});

describe('createTask with a client id', () => {
  it('uses the client id and returns the same row when the create is replayed', async () => {
    const id = crypto.randomUUID();
    const first = await createTask(userId, { id, title: 'Offline task', artifactType: 'task' });
    const replay = await createTask(userId, { id, title: 'Offline task', artifactType: 'task' });

    expect(first.id).toBe(id);
    expect(replay.id).toBe(id);
    const rows = await pool.query(`SELECT 1 FROM app.tasks WHERE id = $1`, [id]);
    expect(rows.rowCount).toBe(1);
  });

  it('refuses an id that belongs to another user', async () => {
    const id = crypto.randomUUID();
    await createTask(otherUserId, { id, title: 'Not yours', artifactType: 'task' });

    await expect(
      createTask(userId, { id, title: 'Stolen id', artifactType: 'task' }),
    ).rejects.toBeInstanceOf(ValidationError);
    const stillTheirs = await pool.query(`SELECT owner_userId FROM app.tasks WHERE id = $1`, [id]);
    expect(stillTheirs.rows[0].owner_userid).toBe(otherUserId);
  });
});

describe('deleteTask', () => {
  it('keeps a tombstone and hides the task from every read', async () => {
    const task = await createTask(userId, { title: 'Delete me', artifactType: 'task' });

    expect(await deleteTask(userId, task.id)).toBe(true);

    const row = await pool.query(`SELECT deleted_at FROM app.tasks WHERE id = $1`, [task.id]);
    expect(row.rows[0].deleted_at).not.toBeNull();
    expect((await getTaskDetail(userId, task.id)).task).toBeNull();
    expect((await listTasks(userId)).some((t) => t.id === task.id)).toBe(false);
    expect(await updateTask(userId, task.id, { title: 'Revived' })).toBeNull();
    expect(await completeTask(userId, task.id, true)).toBeNull();
    expect(await deleteTask(userId, task.id)).toBe(false);
  });

  it('deletes the children of a task list with it', async () => {
    const parent = await createTask(userId, { title: 'List', artifactType: 'task_list' });
    const child = await createTask(userId, {
      title: 'Child',
      artifactType: 'task',
      parentTaskId: parent.id,
    });

    await deleteTask(userId, parent.id);

    const changes = await listTaskChanges(userId, { limit: 500 });
    expect(changes.tasks.find((t) => t.id === child.id)?.deletedAt).not.toBeNull();
  });
});

describe('listTaskChanges', () => {
  it('returns changes after the cursor, oldest first, tombstones included', async () => {
    const before = await listTaskChanges(userId, { limit: 500 });
    const since = before.cursor ?? undefined;

    const kept = await createTask(userId, { title: 'Kept', artifactType: 'task' });
    const removed = await createTask(userId, { title: 'Removed', artifactType: 'task' });
    await deleteTask(userId, removed.id);

    const changes = await listTaskChanges(userId, { since, limit: 500 });
    const ids = changes.tasks.map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([kept.id, removed.id]));
    expect(changes.tasks.find((t) => t.id === removed.id)?.deletedAt).not.toBeNull();
    expect(changes.hasMore).toBe(false);
    const times = changes.tasks.map((t) => t.updatedAt);
    expect([...times].sort()).toEqual(times);

    const nothingNew = await listTaskChanges(userId, { since: changes.cursor!, limit: 500 });
    expect(nothingNew.tasks).toEqual([]);
    expect(nothingNew.hasMore).toBe(false);
  });

  it('pages with hasMore and the last cursor', async () => {
    await createTask(userId, { title: 'Page 1', artifactType: 'task' });
    await createTask(userId, { title: 'Page 2', artifactType: 'task' });

    const page = await listTaskChanges(userId, { limit: 1 });
    expect(page.tasks).toHaveLength(1);
    expect(page.hasMore).toBe(true);
    expect(page.cursor).toBe(`${page.tasks[0]!.updatedAt}_${page.tasks[0]!.id}`);

    const next = await listTaskChanges(userId, { since: page.cursor!, limit: 1 });
    expect(next.tasks[0]?.id).not.toBe(page.tasks[0]!.id);
  });

  it('never returns another user’s tasks', async () => {
    const theirs = await createTask(otherUserId, { title: 'Theirs', artifactType: 'task' });
    const mine = await listTaskChanges(userId, { limit: 500 });
    expect(mine.tasks.some((t) => t.id === theirs.id)).toBe(false);
  });
});
