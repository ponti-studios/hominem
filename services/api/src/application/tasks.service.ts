import { db } from '@hominem/db/core';
import { TaskRepository, type CreateTaskBatchInput, type TaskRecord } from '@hominem/db/tasks';
import { runInTransaction } from '@hominem/db/transaction';

export type TaskDraft = CreateTaskBatchInput['tasks'][number];

export interface TaskDraftGroup {
  title: string;
  tasks: TaskDraft[];
}

export interface PersistExtractedTasksInput {
  groups?: TaskDraftGroup[];
  tasks?: TaskDraft[];
}

export interface PersistedTaskGroup {
  parent: TaskRecord;
  tasks: TaskRecord[];
}

export interface PersistExtractedTasksResult {
  groups: PersistedTaskGroup[];
  tasks: TaskRecord[];
}

/**
 * Persist extracted tasks: each group becomes a `task_list` parent (titled by
 * the caller, typically the LLM's own group title) plus child rows; each
 * standalone draft becomes its own top-level `task` row. Everything happens
 * in one transaction except the common single-standalone-task case, which
 * keeps the old no-transaction fast path.
 */
export async function persistExtractedTasks(
  userId: string,
  input: PersistExtractedTasksInput,
): Promise<PersistExtractedTasksResult> {
  const groups = input.groups ?? [];
  const standalone = input.tasks ?? [];

  if (groups.length === 0 && standalone.length === 0) {
    return { groups: [], tasks: [] };
  }

  if (groups.length === 0 && standalone.length === 1) {
    const [draft] = standalone;
    const task = await TaskRepository.create(db, {
      artifactType: 'task',
      description: draft.description ?? null,
      title: draft.title,
      userId,
      priority: draft.priority,
      dueAt: draft.dueAt ?? null,
    });
    return { groups: [], tasks: [task] };
  }

  return runInTransaction(async (trx) => {
    const persistedGroups: PersistedTaskGroup[] = [];
    for (const group of groups) {
      persistedGroups.push(
        await TaskRepository.createBatch(trx, {
          userId,
          parentTitle: group.title,
          tasks: group.tasks,
        }),
      );
    }

    const persistedStandalone: TaskRecord[] = [];
    for (const draft of standalone) {
      persistedStandalone.push(
        await TaskRepository.create(trx, {
          artifactType: 'task',
          description: draft.description ?? null,
          title: draft.title,
          userId,
          priority: draft.priority,
          dueAt: draft.dueAt ?? null,
        }),
      );
    }

    return { groups: persistedGroups, tasks: persistedStandalone };
  });
}
