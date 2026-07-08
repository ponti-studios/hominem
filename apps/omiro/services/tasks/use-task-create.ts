import { useApiClient } from '@hominem/rpc/react';
import type { Task, TaskDetailOutput, TaskListItem } from '@hominem/rpc/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from './query-keys';

interface UseTaskCreateOptions {
  parentId?: string;
}

interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: 'low' | 'medium' | 'high';
  dueAt?: string | null;
  parentTaskId?: string | null;
}

function buildOptimisticTask(input: CreateTaskInput, optimisticId: string): Task {
  const now = new Date().toISOString();

  return {
    id: optimisticId,
    ownerUserId: '',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    parentTaskId: input.parentTaskId ?? null,
    status: 'pending',
    priority: input.priority ?? 'medium',
    dueAt: input.dueAt ?? null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    artifactType: 'task',
  };
}

export function useTaskCreate({ parentId }: UseTaskCreateOptions = {}) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const res = await client.api.tasks.$post({
        json: {
          title: input.title.trim(),
          description: input.description ?? null,
          artifactType: 'task',
          priority: input.priority,
          dueAt: input.dueAt ?? null,
          parentTaskId: parentId ?? input.parentTaskId ?? null,
        },
      });
      return res.json();
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      const optimisticId = `optimistic-task-${Date.now().toString()}`;
      const optimisticTask = buildOptimisticTask(
        { ...input, parentTaskId: parentId },
        optimisticId,
      );

      const previousAll = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
      const previousDetail = parentId
        ? queryClient.getQueryData<TaskDetailOutput>(taskKeys.detail(parentId))
        : undefined;

      if (parentId) {
        queryClient.setQueryData<TaskDetailOutput>(taskKeys.detail(parentId), (current) =>
          current ? { ...current, children: [...current.children, optimisticTask] } : current,
        );
        queryClient.setQueryData<TaskListItem[]>(taskKeys.all, (current) =>
          current?.map((task) =>
            task.id === parentId ? { ...task, childCount: (task.childCount ?? 0) + 1 } : task,
          ),
        );
      } else {
        queryClient.setQueryData<TaskListItem[]>(taskKeys.all, (current) => [
          { ...optimisticTask, childCount: 0 },
          ...(current ?? []),
        ]);
      }

      return { optimisticId, previousAll, previousDetail };
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      queryClient.setQueryData(taskKeys.all, context.previousAll);
      if (parentId) {
        queryClient.setQueryData(taskKeys.detail(parentId), context.previousDetail);
      }
    },
    onSuccess: (createdTask, _input, context) => {
      if (parentId) {
        queryClient.setQueryData<TaskDetailOutput>(taskKeys.detail(parentId), (current) =>
          current
            ? {
                ...current,
                children: current.children.map((child) =>
                  child.id === context?.optimisticId ? createdTask : child,
                ),
              }
            : current,
        );
      } else {
        queryClient.setQueryData<TaskListItem[]>(taskKeys.all, (current) =>
          current?.map((task) =>
            task.id === context?.optimisticId ? { ...createdTask, childCount: 0 } : task,
          ),
        );
        queryClient.setQueryData(taskKeys.detail(createdTask.id), {
          task: createdTask,
          children: [],
        } satisfies TaskDetailOutput);
      }
    },
  });
}
