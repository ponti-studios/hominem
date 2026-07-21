import type { TaskListItem } from '@hominem/rpc/types';

function matchesQuery(task: TaskListItem, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  return [task.title, task.description].some((value) =>
    value?.toLowerCase().includes(normalizedQuery),
  );
}

export function filterTasks(tasks: TaskListItem[], searchQuery: string): TaskListItem[] {
  return tasks.filter((task) => matchesQuery(task, searchQuery));
}
