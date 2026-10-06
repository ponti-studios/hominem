import type { TaskChange } from '@hominem/rpc/types';

import type { Task } from '../task-types';

// What the app stores per task: the shape the UI reads plus the server's
// bookkeeping. `updatedAt` is the server's last-change time for the row.
export interface StoredTask extends Task {
  updatedAt: string | null;
  deletedAt: string | null;
}

// The UI keeps one time model (`startAt`/`dueAt`, where `dueAt` closes a time
// block when `startAt` is set); the server splits it into a due time and a
// scheduled interval. These two functions are the only place that knows both.
export function fromServerTask(record: TaskChange): StoredTask {
  const startAt = record.scheduledStartAt;
  return {
    id: record.id,
    title: record.title,
    notes: record.description,
    status: record.status === 'completed' ? 'completed' : 'pending',
    completedAt: record.completedAt,
    // Priority is not a feature in the app; the server's default is ignored.
    priority: 'none',
    startAt,
    dueAt: record.dueAt ?? record.scheduledEndAt,
    location: record.location,
    listTitle: null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export interface ServerTaskFields {
  title: string;
  description: string | null;
  dueAt: string | null;
  scheduledStartAt: string | null;
  scheduledEndAt: string | null;
  location: string | null;
}

export function toServerFields(
  task: Pick<Task, 'title' | 'notes' | 'startAt' | 'dueAt' | 'location'>,
): ServerTaskFields {
  // A block needs both ends; a lone start has no end, so it is just a due time.
  const isBlock = Boolean(task.startAt && task.dueAt);
  return {
    title: task.title,
    description: task.notes,
    dueAt: task.dueAt ?? task.startAt,
    scheduledStartAt: isBlock ? task.startAt : null,
    scheduledEndAt: isBlock ? task.dueAt : null,
    location: task.location,
  };
}
