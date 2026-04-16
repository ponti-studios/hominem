import type { Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppTasks } from '../../types/database';

type TaskRow = Selectable<AppTasks>;

export interface TaskRecord {
  id: string;
  ownerUserId: string;
  title: string;
  description: string | null;
  parentTaskId: string | null;
  status: string;
  priority: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  artifactType: 'task' | 'task_list';
}

export interface CreateTaskInput {
  userId: string;
  title: string;
  description?: string | null;
  artifactType: 'task' | 'task_list';
}

function toTaskRecord(row: TaskRow, artifactType: 'task' | 'task_list'): TaskRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_userid,
    title: row.title,
    description: row.description ?? null,
    parentTaskId: row.parent_task_id,
    status: row.status,
    priority: row.priority,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    createdAt: new Date(row.createdat).toISOString(),
    updatedAt: new Date(row.updatedat).toISOString(),
    artifactType,
  };
}

export const TaskRepository = {
  async create(handle: DbHandle, input: CreateTaskInput): Promise<TaskRecord> {
    const task = await handle
      .insertInto('app.tasks')
      .values({
        owner_userid: input.userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        parent_task_id: null,
        primary_space_id: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toTaskRecord(task as TaskRow, input.artifactType);
  },
};
