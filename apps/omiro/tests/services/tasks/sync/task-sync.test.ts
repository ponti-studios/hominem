import { describe, expect, it } from 'vitest';

import { createMemoryTaskStore } from '~/services/tasks/sync/memory-task-store';
import { createTaskService, TaskNeedsDateError } from '~/services/tasks/sync/task-service';

import { createFakeTaskServer } from './fake-task-server';

const DUE = '2026-10-07T15:00:00.000Z';

function setup() {
  const server = createFakeTaskServer();
  const store = createMemoryTaskStore();
  let id = 0;
  const service = createTaskService({
    store,
    getApi: () => server.api,
    newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
  });
  return { server, store, service };
}

describe('task service (local first)', () => {
  it('refuses a task with no date and queues nothing', () => {
    const { service, store } = setup();

    expect(() => service.create({ title: 'Someday' })).toThrow(TaskNeedsDateError);
    expect(store.listOps()).toEqual([]);
    expect(service.list()).toEqual([]);
  });

  it('shows a created task immediately and sends it once online', async () => {
    const { service, server } = setup();
    server.setOffline(true);

    const task = service.create({ title: 'Call dentist', dueAt: DUE });
    expect(service.list().map((t) => t.id)).toEqual([task.id]);

    server.setOffline(false);
    const result = await service.sync();

    expect(result).toMatchObject({ online: true, pushed: 1, failed: 0 });
    expect(server.rows.get(task.id)?.title).toBe('Call dentist');
    expect(service.failedCount()).toBe(0);
  });

  it('keeps every offline edit and replays them in order', async () => {
    const { service, server, store } = setup();
    const task = service.create({ title: 'Draft', dueAt: DUE });
    await service.sync();
    server.setOffline(true);

    service.update(task.id, { title: 'Final' });
    service.complete(task.id, true);
    expect(store.listOps().map((op) => op.payload.kind)).toEqual(['update', 'complete']);

    server.setOffline(false);
    await service.sync();

    expect(server.rows.get(task.id)).toMatchObject({ title: 'Final', status: 'completed' });
    expect(store.listOps()).toEqual([]);
  });

  it('does not duplicate a create that was sent but never acknowledged', async () => {
    const { service, server, store } = setup();
    const task = service.create({ title: 'Once', dueAt: DUE });
    await service.sync();
    // The response was lost: the op is still queued although the server has the row.
    store.enqueue(task.id, {
      kind: 'create',
      fields: {
        title: 'Once',
        description: null,
        dueAt: DUE,
        scheduledStartAt: null,
        scheduledEndAt: null,
        location: null,
      },
    });

    await service.sync();

    expect([...server.rows.keys()]).toEqual([task.id]);
    expect(store.listOps()).toEqual([]);
  });

  it('removes a deleted task locally at once and on the server later', async () => {
    const { service, server } = setup();
    const task = service.create({ title: 'Temp', dueAt: DUE });
    await service.sync();
    server.setOffline(true);

    service.remove(task.id);
    expect(service.list()).toEqual([]);

    server.setOffline(false);
    await service.sync();
    expect(server.rows.get(task.id)?.deletedAt).not.toBeNull();
    expect(service.list()).toEqual([]);
  });

  it('treats a 404 on an edit as done when another device deleted the task', async () => {
    const { service, server, store } = setup();
    const task = service.create({ title: 'Shared', dueAt: DUE });
    await service.sync();
    server.setOffline(true);
    service.complete(task.id, true);
    server.deleteElsewhere(task.id);

    server.setOffline(false);
    const result = await service.sync();

    expect(result).toMatchObject({ online: true, failed: 0 });
    expect(store.listOps()).toEqual([]);
    expect(service.get(task.id)).toBeNull();
  });

  it('marks a refused create as failed and blocks that task’s later edits', async () => {
    const { service, server, store } = setup();
    server.refuseCreates({ status: 400, message: 'Invalid task' });
    const task = service.create({ title: 'Refused', dueAt: DUE });
    service.update(task.id, { title: 'Refused again' });

    const result = await service.sync();

    expect(result).toMatchObject({ online: true, failed: 1 });
    expect(service.failedCount()).toBe(1);
    expect(store.listOps().find((op) => op.status === 'failed')?.failedReason).toBe('Invalid task');
    expect(server.calls.filter((call) => call.startsWith('update'))).toEqual([]);
  });

  it('retries on a server error without losing the queue', async () => {
    const { service, server, store } = setup();
    server.refuseCreates({ status: 503, message: 'Unavailable' });
    service.create({ title: 'Later', dueAt: DUE });

    const result = await service.sync();

    expect(result).toMatchObject({ online: false });
    expect(store.listOps()).toHaveLength(1);
    expect(store.listOps()[0]?.status).toBe('pending');
  });
});

describe('pulling changes', () => {
  it('brings in tasks from another device and applies their deletion', async () => {
    const { service, server } = setup();
    const task = service.create({ title: 'From phone', dueAt: DUE });
    await service.sync();

    server.editElsewhere(task.id, { title: 'Edited on iPad' });
    await service.sync();
    expect(service.get(task.id)?.title).toBe('Edited on iPad');

    server.deleteElsewhere(task.id);
    await service.sync();
    expect(service.get(task.id)).toBeNull();
  });

  it('pages through large feeds without repeating or skipping', async () => {
    const { service, server } = setup();
    for (let i = 0; i < 5; i += 1) {
      service.create({ title: `Task ${i}`, dueAt: DUE });
    }
    await service.sync();
    server.setPageSize(2);
    service.list().forEach((task) => server.editElsewhere(task.id, { title: `${task.title}!` }));

    await service.sync();

    expect(
      service
        .list()
        .map((t) => t.title)
        .sort(),
    ).toEqual(['Task 0!', 'Task 1!', 'Task 2!', 'Task 3!', 'Task 4!']);
  });

  it('keeps a local edit that has not been sent over a newer server copy', async () => {
    const { service, server } = setup();
    const task = service.create({ title: 'Mine', dueAt: DUE });
    await service.sync();
    server.setOffline(true);
    service.update(task.id, { title: 'Local edit' });
    server.editElsewhere(task.id, { title: 'Server edit' });

    server.setOffline(false);
    await service.sync();

    expect(service.get(task.id)?.title).toBe('Local edit');
    expect(server.rows.get(task.id)?.title).toBe('Local edit');
  });

  it('merges a block into startAt/dueAt and back', async () => {
    const { service, server } = setup();
    const task = service.create({
      title: 'Focus',
      startAt: '2026-10-07T09:00:00.000Z',
      dueAt: '2026-10-07T10:30:00.000Z',
    });
    await service.sync();

    expect(server.rows.get(task.id)).toMatchObject({
      scheduledStartAt: '2026-10-07T09:00:00.000Z',
      scheduledEndAt: '2026-10-07T10:30:00.000Z',
      dueAt: '2026-10-07T10:30:00.000Z',
    });
    server.editElsewhere(task.id, { title: 'Focus!' });
    await service.sync();
    expect(service.get(task.id)).toMatchObject({
      startAt: '2026-10-07T09:00:00.000Z',
      dueAt: '2026-10-07T10:30:00.000Z',
    });
  });
});
