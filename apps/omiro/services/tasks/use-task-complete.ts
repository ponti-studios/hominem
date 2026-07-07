import { useApiClient } from '@hominem/rpc/react';
import type { Task, TaskDetailOutput, TaskListItem } from '@hominem/rpc/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from './query-keys';

interface UseTaskCompleteOptions {
  parentId?: string;
}

function applyCompleted<T extends Task>(task: T, completed: boolean): T {
  return {
    ...task,
    status: completed ? 'completed' : 'pending',
    completedAt: completed ? new Date().toISOString() : null,
  };
}

export function useTaskComplete({ parentId }: UseTaskCompleteOptions = {}) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, completed }: { taskId: string; completed: boolean }) => {
      const res = await client.api.tasks[':id'].complete.$patch({
        param: { id: taskId },
        json: { completed },
      });
      return res.json();
    },
    onMutate: async ({ taskId, completed }) => {
      queryClient.setQueryData<TaskListItem[]>(taskKeys.all, (current) =>
        current?.map((task) => (task.id === taskId ? applyCompleted(task, completed) : task)),
      );

      if (parentId) {
        queryClient.setQueryData<TaskDetailOutput>(taskKeys.detail(parentId), (current) =>
          current
            ? {
                ...current,
                children: current.children.map((child) =>
                  child.id === taskId ? applyCompleted(child, completed) : child,
                ),
              }
            : current,
        );
      } else {
        queryClient.setQueryData<TaskDetailOutput>(taskKeys.detail(taskId), (current) =>
          current ? { ...current, task: applyCompleted(current.task, completed) } : current,
        );
      }
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData<TaskListItem[]>(taskKeys.all, (current) =>
        current?.map((task) => (task.id === updatedTask.id ? { ...task, ...updatedTask } : task)),
      );
    },
  });
}
