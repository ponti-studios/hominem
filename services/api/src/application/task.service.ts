import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import {
  TaskRepository,
  type CreateTaskInput,
  type TaskListRecord,
  type TaskParticipantRecord,
  type TaskRecord,
  type UpdateTaskInput,
} from '@hominem/db/tasks';
import { runInTransaction } from '@hominem/db/transaction';

export { persistExtractedTasks } from './tasks.service';

export async function listTasks(ownerUserId: string): Promise<TaskListRecord[]> {
  return TaskRepository.list(db, { userId: ownerUserId });
}

export interface TaskDetail {
  task: TaskRecord | null;
  participants: TaskParticipantRecord[];
  children: TaskRecord[];
}

export async function getTaskDetail(ownerUserId: string, id: string): Promise<TaskDetail> {
  let task: TaskRecord;
  try {
    task = await TaskRepository.load(db, id, ownerUserId);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return { task: null, participants: [], children: [] };
    }
    throw error;
  }

  const [participants, children] = await Promise.all([
    TaskRepository.listParticipants(db, { taskId: id, userId: ownerUserId }),
    task.artifactType === 'task_list'
      ? TaskRepository.listChildren(db, { parentId: id, userId: ownerUserId })
      : Promise.resolve([]),
  ]);

  return { task, participants, children };
}

export interface CreateTaskServiceInput extends Omit<CreateTaskInput, 'userId'> {
  participants?: string[];
}

export async function createTask(
  ownerUserId: string,
  input: CreateTaskServiceInput,
): Promise<TaskRecord> {
  // An invalid parentTaskId is a genuine client error at creation time (there is no
  // existing resource to fall back to), so this intentionally is not caught below.
  if (input.parentTaskId) {
    const parent = await TaskRepository.getOwned(db, input.parentTaskId, ownerUserId);
    if (!parent) {
      throw new NotFoundError('Task', { taskId: input.parentTaskId });
    }
  }

  const { participants, ...rest } = input;

  return runInTransaction(async (trx) => {
    const created = await TaskRepository.create(trx, { ...rest, userId: ownerUserId });
    if (participants) {
      await TaskRepository.replaceParticipants(trx, {
        taskId: created.id,
        userId: ownerUserId,
        participants,
      });
    }
    return created;
  });
}

export interface UpdateTaskServiceInput extends UpdateTaskInput {
  participants?: string[];
}

export async function updateTask(
  ownerUserId: string,
  id: string,
  patch: UpdateTaskServiceInput,
): Promise<TaskRecord | null> {
  const { participants, ...rest } = patch;

  try {
    return await runInTransaction(async (trx) => {
      const updated = await TaskRepository.update(trx, id, ownerUserId, rest);
      if (participants) {
        await TaskRepository.replaceParticipants(trx, {
          taskId: id,
          userId: ownerUserId,
          participants,
        });
      }
      return updated;
    });
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function completeTask(
  ownerUserId: string,
  id: string,
  completed: boolean,
): Promise<TaskRecord | null> {
  try {
    return await TaskRepository.setCompleted(db, id, ownerUserId, completed);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export async function deleteTask(ownerUserId: string, id: string): Promise<boolean> {
  try {
    await TaskRepository.remove(db, id, ownerUserId);
    return true;
  } catch (error) {
    if (error instanceof NotFoundError) return false;
    throw error;
  }
}
