import type { ReminderPriority, ReminderRecord, ReminderStatus } from '~/modules/reminders';

// Tasks are EKReminder records read straight from Apple Reminders -- no
// separate backend row, no parentTaskId/childCount (EventKit has no public
// sub-task API) and no participants (no public assignment API either).
export type Task = ReminderRecord;
export type TaskListItem = ReminderRecord;
export type TaskStatus = ReminderStatus;
export type TaskPriority = ReminderPriority;

export interface TaskDetailOutput {
  task: Task;
}

// EKReminder has no stored duration -- this derives it from start/due the
// same way everywhere it's needed, so it can't quietly drift between call
// sites.
export function taskDurationMinutes(task: Pick<Task, 'startAt' | 'dueAt'>): number | null {
  if (!task.startAt || !task.dueAt) {
    return null;
  }
  const minutes = Math.round(
    (new Date(task.dueAt).getTime() - new Date(task.startAt).getTime()) / 60_000,
  );
  return minutes > 0 ? minutes : null;
}
