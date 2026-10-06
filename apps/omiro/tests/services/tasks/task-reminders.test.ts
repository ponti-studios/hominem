import { describe, expect, it } from 'vitest';

import {
  MAX_SCHEDULED,
  planReminders,
  reconcileReminders,
  reminderTime,
  type PlannedReminder,
  type ScheduledReminder,
} from '~/services/tasks/notifications/task-reminders';
import type { StoredTask } from '~/services/tasks/sync/task-mapping';

const NOW = new Date(2026, 9, 6, 12, 0);

function task(id: string, overrides: Partial<StoredTask> = {}): StoredTask {
  return {
    id,
    title: `Task ${id}`,
    notes: null,
    status: 'pending',
    completedAt: null,
    priority: 'none',
    startAt: null,
    dueAt: null,
    location: null,
    listTitle: null,
    createdAt: null,
    updatedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('reminderTime', () => {
  it('uses the time for a timed task and 9:00 for a day-only task', () => {
    const timed = new Date(2026, 9, 7, 15, 30);
    expect(reminderTime({ startAt: null, dueAt: timed.toISOString() })).toEqual(timed);
    const day = new Date(2026, 9, 7);
    expect(reminderTime({ startAt: null, dueAt: day.toISOString() })).toEqual(
      new Date(2026, 9, 7, 9),
    );
  });

  it('uses the start of a time block and nothing for an undated task', () => {
    const start = new Date(2026, 9, 7, 10);
    const end = new Date(2026, 9, 7, 11);
    expect(reminderTime({ startAt: start.toISOString(), dueAt: end.toISOString() })).toEqual(start);
    expect(reminderTime({ startAt: null, dueAt: null })).toBeNull();
  });
});

describe('planReminders', () => {
  it('keeps only future reminders for open tasks, soonest first', () => {
    const planned = planReminders(
      [
        task('late', { dueAt: new Date(2026, 9, 9, 8).toISOString() }),
        task('soon', { dueAt: new Date(2026, 9, 7, 8).toISOString() }),
        task('past', { dueAt: new Date(2026, 9, 6, 8).toISOString() }),
        task('done', { dueAt: new Date(2026, 9, 8, 8).toISOString(), status: 'completed' }),
        task('gone', { dueAt: new Date(2026, 9, 8, 8).toISOString(), deletedAt: 'x' }),
        task('inbox'),
      ],
      NOW,
    );
    expect(planned.map((reminder) => reminder.taskId)).toEqual(['soon', 'late']);
  });

  it('stays under the iOS limit', () => {
    const many = Array.from({ length: MAX_SCHEDULED + 10 }, (_, index) =>
      task(`t${index}`, { dueAt: new Date(2026, 9, 7, 8, index).toISOString() }),
    );
    expect(planReminders(many, NOW)).toHaveLength(MAX_SCHEDULED);
  });
});

describe('reconcileReminders', () => {
  function fakeScheduler(initial: ScheduledReminder[]) {
    const state = new Map(initial.map((entry) => [entry.taskId, entry]));
    return {
      state,
      scheduler: {
        scheduled: async () => [...state.values()],
        schedule: async (reminder: PlannedReminder) => {
          state.set(reminder.taskId, {
            taskId: reminder.taskId,
            at: reminder.at.getTime(),
            title: reminder.title,
          });
        },
        cancel: async (taskId: string) => {
          state.delete(taskId);
        },
      },
    };
  }

  it('adds, moves and cancels to match the plan', async () => {
    const at = new Date(2026, 9, 7, 8);
    const moved = new Date(2026, 9, 8, 8);
    const { state, scheduler } = fakeScheduler([
      { taskId: 'keep', at: at.getTime(), title: 'Keep' },
      { taskId: 'move', at: at.getTime(), title: 'Move' },
      { taskId: 'drop', at: at.getTime(), title: 'Drop' },
    ]);
    await reconcileReminders(scheduler, [
      { taskId: 'keep', title: 'Keep', at },
      { taskId: 'move', title: 'Move', at: moved },
      { taskId: 'new', title: 'New', at },
    ]);
    expect([...state.keys()].sort()).toEqual(['keep', 'move', 'new']);
    expect(state.get('move')?.at).toBe(moved.getTime());
  });
});
