import { formatClockTime } from '~/services/date/format-date';
import type { TaskListItem } from '~/services/tasks/task-types';

export function getOpenTasks(tasks: TaskListItem[]) {
  return tasks.filter((task) => task.status !== 'completed');
}

// "9:00 – 10:00", a single time, or null when the task has no time at all.
export function taskTimeLabel({ dueAt, startAt }: Pick<TaskListItem, 'dueAt' | 'startAt'>) {
  if (startAt && dueAt) {
    return `${formatClockTime(startAt)} – ${formatClockTime(dueAt)}`;
  }
  const when = startAt ?? dueAt;
  return when ? formatClockTime(when) : null;
}
