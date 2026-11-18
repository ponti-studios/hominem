import type { StoredTask } from '../sync/task-mapping';
import type { TaskPatch, TaskService } from '../sync/task-service';

// The notification category that gives a task reminder its buttons.
export const REMINDER_CATEGORY = 'task-reminder';

export const REMINDER_ACTION = { complete: 'complete', snooze: 'snooze' } as const;

export const SNOOZE_MINUTES = 60;

// Moves a task an hour on from `now`. A time block keeps its length.
export function snoozePatch(task: Pick<StoredTask, 'startAt' | 'dueAt'>, now: Date): TaskPatch {
  const next = new Date(now.getTime() + SNOOZE_MINUTES * 60_000);
  if (!task.startAt) {
    return { dueAt: next.toISOString() };
  }
  const length = task.dueAt
    ? new Date(task.dueAt).getTime() - new Date(task.startAt).getTime()
    : null;
  return {
    startAt: next.toISOString(),
    dueAt: length === null ? null : new Date(next.getTime() + length).toISOString(),
  };
}

interface ReminderResponse {
  actionIdentifier: string;
  taskId: unknown;
}

// Applies a button pressed on a task reminder to the local task database (the
// sync and the rescheduling follow from the change). Returns false when the
// response was not one of ours, or the task is gone or already done.
export function applyReminderAction(
  service: Pick<TaskService, 'get' | 'complete' | 'update'>,
  { actionIdentifier, taskId }: ReminderResponse,
  now: Date,
): boolean {
  if (typeof taskId !== 'string') {
    return false;
  }
  const task = service.get(taskId);
  if (!task || task.status !== 'pending' || task.deletedAt) {
    return false;
  }
  if (actionIdentifier === REMINDER_ACTION.complete) {
    service.complete(taskId, true);
    return true;
  }
  if (actionIdentifier === REMINDER_ACTION.snooze) {
    service.update(taskId, snoozePatch(task, now));
    return true;
  }
  return false;
}
