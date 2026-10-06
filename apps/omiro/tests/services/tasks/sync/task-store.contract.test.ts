import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { createMemoryTaskStore } from '~/services/tasks/sync/memory-task-store';
import {
  createSqliteTaskStore,
  type SqliteDriver,
  type SqlValue,
} from '~/services/tasks/sync/sqlite-task-store';
import type { StoredTask } from '~/services/tasks/sync/task-mapping';
import type { TaskStore } from '~/services/tasks/sync/task-store';

function nodeDriver(): SqliteDriver {
  const db = new DatabaseSync(':memory:');
  return {
    exec: (sql) => db.exec(sql),
    run: (sql, params: SqlValue[] = []) => ({
      lastInsertRowId: Number(db.prepare(sql).run(...params).lastInsertRowid),
    }),
    all: (sql, params: SqlValue[] = []) => db.prepare(sql).all(...params),
  };
}

function task(id: string, overrides: Partial<StoredTask> = {}): StoredTask {
  return {
    id,
    title: `Task ${id}`,
    notes: null,
    status: 'pending',
    completedAt: null,
    priority: 'none',
    startAt: null,
    dueAt: '2026-10-07T15:00:00.000Z',
    location: null,
    listTitle: null,
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

const stores: [string, () => TaskStore][] = [
  ['memory', createMemoryTaskStore],
  ['sqlite', () => createSqliteTaskStore(nodeDriver())],
];

describe.each(stores)('%s task store', (_name, create) => {
  it('stores, replaces and removes tasks', () => {
    const store = create();
    store.putTask(task('a'));
    store.putTask(task('a', { title: 'Renamed' }));
    store.putTask(task('b'));

    expect(store.getTask('a')?.title).toBe('Renamed');
    expect(
      store
        .listTasks()
        .map((t) => t.id)
        .sort(),
    ).toEqual(['a', 'b']);

    store.removeTask('a');
    expect(store.getTask('a')).toBeNull();
  });

  it('keeps every field through a round trip', () => {
    const store = create();
    const full = task('a', {
      notes: 'bring the form',
      status: 'completed',
      completedAt: '2026-10-06T11:00:00.000Z',
      startAt: '2026-10-07T14:00:00.000Z',
      location: 'Clinic',
      updatedAt: '2026-10-06T10:00:00.123Z',
    });
    store.putTask(full);

    expect(store.getTask('a')).toEqual(full);
  });

  it('hides tombstoned tasks from the list', () => {
    const store = create();
    store.putTask(task('a', { deletedAt: '2026-10-06T12:00:00.000Z' }));
    store.putTask(task('b'));

    expect(store.listTasks().map((t) => t.id)).toEqual(['b']);
  });

  it('puts undated tasks after dated ones, oldest first', () => {
    const store = create();
    store.putTask(task('new', { dueAt: null, createdAt: '2026-10-06T12:00:00.000Z' }));
    store.putTask(task('old', { dueAt: null, createdAt: '2026-10-01T12:00:00.000Z' }));
    store.putTask(task('dated', { dueAt: '2026-10-09T10:00:00.000Z' }));

    expect(store.listTasks().map((t) => t.id)).toEqual(['dated', 'old', 'new']);
  });

  it('orders the list by when the task happens', () => {
    const store = create();
    store.putTask(task('late', { dueAt: '2026-10-09T10:00:00.000Z' }));
    store.putTask(task('early', { dueAt: '2026-10-07T10:00:00.000Z' }));
    store.putTask(
      task('block', { startAt: '2026-10-08T09:00:00.000Z', dueAt: '2026-10-08T10:00:00.000Z' }),
    );

    expect(store.listTasks().map((t) => t.id)).toEqual(['early', 'block', 'late']);
  });

  it('remembers the cursor', () => {
    const store = create();
    expect(store.getCursor()).toBeNull();
    store.setCursor('abc_1');
    expect(store.getCursor()).toBe('abc_1');
    store.setCursor(null);
    expect(store.getCursor()).toBeNull();
  });

  it('queues ops in order and updates their status', () => {
    const store = create();
    const first = store.enqueue('a', { kind: 'complete', completed: true });
    const second = store.enqueue('a', { kind: 'delete' });

    expect(first.id).toBeLessThan(second.id);
    expect(store.listOps().map((op) => op.payload.kind)).toEqual(['complete', 'delete']);

    store.failOp(first.id, 'Refused');
    expect(store.listOps()[0]).toMatchObject({ status: 'failed', failedReason: 'Refused' });

    store.removeOp(first.id);
    expect(store.listOps().map((op) => op.id)).toEqual([second.id]);
  });

  it('round-trips an op payload', () => {
    const store = create();
    const fields = {
      title: 'Call',
      description: null,
      dueAt: '2026-10-07T15:00:00.000Z',
      scheduledStartAt: null,
      scheduledEndAt: null,
      location: 'Home',
    };
    store.enqueue('a', { kind: 'create', fields });

    expect(store.listOps()[0]?.payload).toEqual({ kind: 'create', fields });
  });

  it('clears everything', () => {
    const store = create();
    store.putTask(task('a'));
    store.enqueue('a', { kind: 'delete' });
    store.setCursor('x');

    store.clear();

    expect(store.listTasks()).toEqual([]);
    expect(store.listOps()).toEqual([]);
    expect(store.getCursor()).toBeNull();
  });
});
