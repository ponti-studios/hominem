// What the UI knows about a task. Tasks are owned by the app: they live in
// the local database and sync with the server (see `sync/`).
export type TaskStatus = 'pending' | 'completed';

// Priority is not a feature; the field stays so existing UI code keeps its shape.
export type TaskPriority = 'none' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  completedAt: string | null;
  priority: TaskPriority;
  // A task's time: a single `dueAt`, or a block from `startAt` to `dueAt`.
  startAt: string | null;
  dueAt: string | null;
  location: string | null;
  listTitle: string | null;
  createdAt: string | null;
}

export type TaskListItem = Task;

// A block's length, derived from start and due the same way everywhere.
export function taskDurationMinutes(task: Pick<Task, 'startAt' | 'dueAt'>): number | null {
  if (!task.startAt || !task.dueAt) {
    return null;
  }
  const minutes = Math.round(
    (new Date(task.dueAt).getTime() - new Date(task.startAt).getTime()) / 60_000,
  );
  return minutes > 0 ? minutes : null;
}
