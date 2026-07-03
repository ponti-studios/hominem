import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
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
  parentTaskId?: string | null;
}

export interface CreateTaskBatchInput {
  userId: string;
  parentTitle: string;
  tasks: { title: string; description?: string | null }[];
}

export interface TaskBatchRecord {
  parent: TaskRecord;
  tasks: TaskRecord[];
}

export interface TaskListRecord extends TaskRecord {
  childCount: number;
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
        parent_task_id: input.parentTaskId ?? null,
        primary_space_id: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toTaskRecord(task as TaskRow, input.artifactType);
  },

  /**
   * Creates a parent `task_list` row plus one child `task` row per item.
   * Callers should wrap this in `runInTransaction` so the group is atomic.
   */
  async createBatch(handle: DbHandle, input: CreateTaskBatchInput): Promise<TaskBatchRecord> {
    const parent = await TaskRepository.create(handle, {
      userId: input.userId,
      title: input.parentTitle,
      artifactType: 'task_list',
    });

    const tasks: TaskRecord[] = [];
    for (const item of input.tasks) {
      const task = await TaskRepository.create(handle, {
        userId: input.userId,
        title: item.title,
        description: item.description,
        artifactType: 'task',
        parentTaskId: parent.id,
      });
      tasks.push(task);
    }

    return { parent, tasks };
  },

  /**
   * Top-level tasks owned by the user (standalone tasks and task-list parents).
   * A row is treated as a `task_list` when it has at least one child.
   */
  async list(handle: DbHandle, input: { userId: string }): Promise<TaskListRecord[]> {
    const rows = await handle
      .selectFrom('app.tasks as t')
      .selectAll('t')
      .select((eb) =>
        eb
          .selectFrom('app.tasks as c')
          .select((ceb) => ceb.fn.countAll().as('count'))
          .whereRef('c.parent_task_id', '=', 't.id')
          .as('child_count'),
      )
      .where('t.owner_userid', '=', input.userId)
      .where('t.parent_task_id', 'is', null)
      .orderBy('t.updatedat', 'desc')
      .execute();

    return rows.map((row) => {
      const childCount = Number(row.child_count ?? 0);
      return {
        ...toTaskRecord(row as TaskRow, childCount > 0 ? 'task_list' : 'task'),
        childCount,
      };
    });
  },

  async listChildren(
    handle: DbHandle,
    input: { parentId: string; userId: string },
  ): Promise<TaskRecord[]> {
    const rows = await handle
      .selectFrom('app.tasks')
      .selectAll()
      .where('parent_task_id', '=', input.parentId)
      .where('owner_userid', '=', input.userId)
      .orderBy('createdat', 'asc')
      .execute();

    return (rows as TaskRow[]).map((row) => toTaskRecord(row, 'task'));
  },

  async getOwned(handle: DbHandle, id: string, userId: string): Promise<TaskRow | null> {
    const row = await handle
      .selectFrom('app.tasks')
      .selectAll()
      .where('id', '=', id)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    return (row as TaskRow | undefined) ?? null;
  },

  async load(handle: DbHandle, id: string, userId: string): Promise<TaskRecord> {
    const row = await TaskRepository.getOwned(handle, id, userId);
    if (!row) {
      throw new NotFoundError('Task', { taskId: id });
    }

    const children = await TaskRepository.listChildren(handle, { parentId: id, userId });
    return toTaskRecord(row, children.length > 0 ? 'task_list' : 'task');
  },

  async setCompleted(
    handle: DbHandle,
    id: string,
    userId: string,
    completed: boolean,
  ): Promise<TaskRecord> {
    const row = await handle
      .updateTable('app.tasks')
      .set({
        status: completed ? 'completed' : 'pending',
        completed_at: completed ? new Date() : null,
      })
      .where('id', '=', id)
      .where('owner_userid', '=', userId)
      .returningAll()
      .executeTakeFirst();

    if (!row) {
      throw new NotFoundError('Task', { taskId: id });
    }

    return toTaskRecord(row as TaskRow, 'task');
  },

  async remove(handle: DbHandle, id: string, userId: string): Promise<TaskRecord> {
    const row = await TaskRepository.getOwned(handle, id, userId);
    if (!row) {
      throw new NotFoundError('Task', { taskId: id });
    }

    const children = await TaskRepository.listChildren(handle, { parentId: id, userId });
    if (children.length > 0) {
      await handle
        .deleteFrom('app.tasks')
        .where('parent_task_id', '=', id)
        .where('owner_userid', '=', userId)
        .execute();
    }

    await handle
      .deleteFrom('app.tasks')
      .where('id', '=', id)
      .where('owner_userid', '=', userId)
      .execute();

    return toTaskRecord(row, children.length > 0 ? 'task_list' : 'task');
  },
};
