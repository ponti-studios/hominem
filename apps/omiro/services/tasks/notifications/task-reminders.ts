import type { StoredTask } from '../sync/task-mapping';

// iOS keeps at most 64 local notifications pending; stay under it.
export const MAX_SCHEDULED = 60;
// A task placed on a day, not a time, reminds at this hour.
export const DATE_ONLY_HOUR = 9;

export interface PlannedReminder {
  taskId: string;
  title: string;
  at: Date;
}

function isMidnight(date: Date) {
  return (
    date.getHours() === 0 &&
    date.getMinutes() === 0 &&
    date.getSeconds() === 0 &&
    date.getMilliseconds() === 0
  );
}

// When a task should nudge: a time block at its start, a single time at that
// time, a day-only task at 9:00 that day. Null for undated tasks.
export function reminderTime(task: Pick<StoredTask, 'startAt' | 'dueAt'>): Date | null {
  const when = task.startAt ?? task.dueAt;
  if (!when) {
    return null;
  }
  const date = new Date(when);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return isMidnight(date)
    ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), DATE_ONLY_HOUR)
    : date;
}

// Every future reminder for open tasks, soonest first, capped for iOS.
export function planReminders(tasks: StoredTask[], now: Date): PlannedReminder[] {
  return tasks
    .flatMap((task) => {
      const at = task.status === 'pending' && !task.deletedAt ? reminderTime(task) : null;
      return at && at.getTime() > now.getTime() ? [{ taskId: task.id, title: task.title, at }] : [];
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
}

export interface ScheduledReminder {
  taskId: string;
  at: number;
  title: string;
}

export interface ReminderScheduler {
  scheduled: () => Promise<ScheduledReminder[]>;
  schedule: (reminder: PlannedReminder) => Promise<void>;
  cancel: (taskId: string) => Promise<void>;
}

// Brings the device's scheduled notifications in line with the plan, touching
// only what differs.
export async function reconcileReminders(
  scheduler: ReminderScheduler,
  planned: PlannedReminder[],
): Promise<void> {
  const current = new Map((await scheduler.scheduled()).map((entry) => [entry.taskId, entry]));
  const wanted = new Set(planned.map((reminder) => reminder.taskId));

  await Promise.all(
    [...current.keys()].filter((id) => !wanted.has(id)).map((id) => scheduler.cancel(id)),
  );
  await Promise.all(
    planned
      .filter((reminder) => {
        const existing = current.get(reminder.taskId);
        return (
          !existing || existing.at !== reminder.at.getTime() || existing.title !== reminder.title
        );
      })
      .map(async (reminder) => {
        await scheduler.cancel(reminder.taskId);
        await scheduler.schedule(reminder);
      }),
  );
}
