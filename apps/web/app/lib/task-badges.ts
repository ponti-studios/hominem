import type { TaskListItem } from '@hominem/rpc/types';

export const taskDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
});

export const taskPriorityVariant: Record<string, 'destructive' | 'secondary' | 'outline'> = {
  high: 'destructive',
  medium: 'secondary',
  low: 'outline',
};

export function formatTaskDate(value: string) {
  return taskDateFormatter.format(new Date(value));
}

export function getTaskWhen(task: Pick<TaskListItem, 'dueAt' | 'scheduledStartAt'>) {
  if (task.scheduledStartAt) return formatTaskDate(task.scheduledStartAt);
  if (task.dueAt) return `Due ${formatTaskDate(task.dueAt)}`;
  return null;
}
