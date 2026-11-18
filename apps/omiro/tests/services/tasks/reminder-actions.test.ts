import { describe, expect, it, vi } from 'vitest';

import {
  applyReminderAction,
  REMINDER_ACTION,
  snoozePatch,
} from '~/services/tasks/notifications/reminder-actions';
import type { StoredTask } from '~/services/tasks/sync/task-mapping';

const NOW = new Date('2026-11-17T09:00:00.000Z');

const TASK: StoredTask = {
  completedAt: null,
  createdAt: null,
  deletedAt: null,
  dueAt: null,
  id: 't1',
  listTitle: null,
  location: null,
  notes: null,
  priority: 'none',
  startAt: null,
  status: 'pending',
  title: 'Task',
  updatedAt: null,
};

function fakeService(task: Partial<StoredTask> | null) {
  return {
    complete: vi.fn(),
    get: vi.fn((): StoredTask | null => (task ? { ...TASK, ...task } : null)),
    update: vi.fn(),
  };
}

describe('snoozePatch', () => {
  it('moves a single-time task an hour on from now', () => {
    expect(snoozePatch({ startAt: null, dueAt: '2026-11-17T08:00:00.000Z' }, NOW)).toEqual({
      dueAt: '2026-11-17T10:00:00.000Z',
    });
  });

  it('moves a time block and keeps its length', () => {
    expect(
      snoozePatch({ startAt: '2026-11-17T08:00:00.000Z', dueAt: '2026-11-17T08:45:00.000Z' }, NOW),
    ).toEqual({ startAt: '2026-11-17T10:00:00.000Z', dueAt: '2026-11-17T10:45:00.000Z' });
  });

  it('keeps an open-ended block open-ended', () => {
    expect(snoozePatch({ startAt: '2026-11-17T08:00:00.000Z', dueAt: null }, NOW)).toEqual({
      startAt: '2026-11-17T10:00:00.000Z',
      dueAt: null,
    });
  });
});

describe('applyReminderAction', () => {
  it('completes the task for Done', () => {
    const service = fakeService({ dueAt: '2026-11-17T08:00:00.000Z' });
    const applied = applyReminderAction(
      service,
      { actionIdentifier: REMINDER_ACTION.complete, taskId: 't1' },
      NOW,
    );
    expect(applied).toBe(true);
    expect(service.complete).toHaveBeenCalledWith('t1', true);
  });

  it('moves the task for In an hour', () => {
    const service = fakeService({ startAt: null, dueAt: '2026-11-17T08:00:00.000Z' });
    applyReminderAction(service, { actionIdentifier: REMINDER_ACTION.snooze, taskId: 't1' }, NOW);
    expect(service.update).toHaveBeenCalledWith('t1', { dueAt: '2026-11-17T10:00:00.000Z' });
  });

  it('ignores a plain tap on the notification', () => {
    const service = fakeService({ dueAt: '2026-11-17T08:00:00.000Z' });
    const applied = applyReminderAction(
      service,
      { actionIdentifier: 'expo.modules.notifications.actions.DEFAULT', taskId: 't1' },
      NOW,
    );
    expect(applied).toBe(false);
    expect(service.complete).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('ignores a task that is gone, done or deleted, and a response with no task', () => {
    const response = { actionIdentifier: REMINDER_ACTION.complete, taskId: 't1' };
    expect(applyReminderAction(fakeService(null), response, NOW)).toBe(false);
    expect(applyReminderAction(fakeService({ status: 'completed' }), response, NOW)).toBe(false);
    expect(applyReminderAction(fakeService({ deletedAt: NOW.toISOString() }), response, NOW)).toBe(
      false,
    );
    expect(
      applyReminderAction(
        fakeService({}),
        { actionIdentifier: REMINDER_ACTION.complete, taskId: undefined },
        NOW,
      ),
    ).toBe(false);
  });
});
