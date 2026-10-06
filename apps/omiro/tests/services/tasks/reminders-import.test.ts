import { describe, expect, it, vi } from 'vitest';

import type { ReminderRecord } from '~/modules/reminders';
import { createRemindersImporter } from '~/services/tasks/import/reminders-import';
import type { OutboxOp } from '~/services/tasks/sync/task-store';

function reminder(id: string, overrides: Partial<ReminderRecord> = {}): ReminderRecord {
  return {
    id,
    title: `Reminder ${id}`,
    notes: null,
    status: 'pending',
    completedAt: null,
    priority: 'none',
    startAt: null,
    dueAt: null,
    location: null,
    listTitle: null,
    createdAt: null,
    ...overrides,
  };
}

function op(taskId: string, status: OutboxOp['status'] = 'pending'): OutboxOp {
  return {
    id: 1,
    taskId,
    payload: { kind: 'delete' },
    createdAt: '',
    status,
    failedReason: null,
  };
}

interface SetupOptions {
  permission?: 'authorized' | 'denied' | 'notDetermined';
  list?: ReminderRecord[];
}

function setup({
  permission = 'authorized',
  list = [reminder('r1'), reminder('r2')],
}: SetupOptions = {}) {
  const data = new Map<string, string>();
  const ops = new Map<string, OutboxOp[]>();
  const deleteReminder = vi.fn(async () => undefined);
  let next = 0;
  const create = vi.fn(() => {
    next += 1;
    const id = `t${next}`;
    ops.set(id, [op(id)]);
    return { id };
  });
  const importer = createRemindersImporter({
    reminders: {
      getPermission: async () => permission,
      requestPermission: async () => permission,
      listReminders: async () => list,
      deleteReminder,
    },
    tasks: { create, outboxFor: (id) => ops.get(id) ?? [] },
    storage: {
      get: (key) => data.get(key),
      set: (key, value) => {
        data.set(key, value);
      },
      remove: (key) => {
        data.delete(key);
      },
    },
  });
  return { importer, create, deleteReminder, ops };
}

describe('reminders import', () => {
  it('asks with the number of open reminders', async () => {
    const { importer } = setup({ list: [reminder('r1'), reminder('r2', { status: 'completed' })] });
    expect(await importer.state()).toEqual({ kind: 'ask', count: 1 });
  });

  it('asks without a count before access is granted', async () => {
    const { importer } = setup({ permission: 'notDetermined' });
    expect(await importer.state()).toEqual({ kind: 'ask', count: null });
  });

  it('does not ask when access was denied or there is nothing to import', async () => {
    expect(await setup({ permission: 'denied' }).importer.state()).toEqual({ kind: 'done' });
    expect(await setup({ list: [] }).importer.state()).toEqual({ kind: 'done' });
  });

  it('start fresh creates nothing and deletes nothing', async () => {
    const { importer, create, deleteReminder } = setup();
    importer.startFresh();
    await importer.settle();
    expect(await importer.state()).toEqual({ kind: 'done' });
    expect(create).not.toHaveBeenCalled();
    expect(deleteReminder).not.toHaveBeenCalled();
  });

  it('imports open reminders and keeps them until the server has the tasks', async () => {
    const { importer, create, deleteReminder, ops } = setup();
    expect(await importer.importAll()).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(await importer.state()).toEqual({ kind: 'done' });

    await importer.settle();
    expect(deleteReminder).not.toHaveBeenCalled();

    ops.set('t1', []);
    await importer.settle();
    expect(deleteReminder).toHaveBeenCalledTimes(1);
    expect(deleteReminder).toHaveBeenCalledWith('r1');

    ops.set('t2', []);
    await importer.settle();
    expect(deleteReminder).toHaveBeenCalledTimes(2);
    await importer.settle();
    expect(deleteReminder).toHaveBeenCalledTimes(2);
  });

  it('keeps the reminder when the server refused its task', async () => {
    const { importer, deleteReminder, ops } = setup({ list: [reminder('r1')] });
    await importer.importAll();
    ops.set('t1', [op('t1', 'failed')]);
    await importer.settle();
    expect(deleteReminder).not.toHaveBeenCalled();
  });

  it('imports nothing when access is refused', async () => {
    const { importer, create } = setup({ permission: 'denied' });
    expect(await importer.importAll()).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });

  it('retries a failed removal and forgets one already gone', async () => {
    const { importer, deleteReminder, ops } = setup({ list: [reminder('r1')] });
    await importer.importAll();
    ops.set('t1', []);
    deleteReminder.mockRejectedValueOnce(new Error('busy'));
    await importer.settle();
    deleteReminder.mockRejectedValueOnce(
      Object.assign(new Error('gone'), { code: 'REMINDER_NOT_FOUND' }),
    );
    await importer.settle();
    await importer.settle();
    expect(deleteReminder).toHaveBeenCalledTimes(2);
  });

  it('reset forgets the choice and waiting removals', async () => {
    const { importer, deleteReminder, ops } = setup({ list: [reminder('r1')] });
    await importer.importAll();
    importer.reset();
    ops.set('t1', []);
    await importer.settle();
    expect(deleteReminder).not.toHaveBeenCalled();
    expect(await importer.state()).toEqual({ kind: 'ask', count: 1 });
  });
});
