import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from './query-keys';
import { remindersGateway } from './reminders-gateway';
import type { Task, TaskListItem, TaskPriority } from './task-types';

interface CreateTaskInput {
  title: string;
  notes?: string | null;
  priority?: TaskPriority;
  startAt?: string | null;
  dueAt?: string | null;
  location?: string | null;
}

function buildCreateTaskPayload(input: CreateTaskInput) {
  return {
    title: input.title.trim(),
    notes: input.notes ?? null,
    priority: input.priority ?? 'none',
    startAt: input.startAt ?? null,
    dueAt: input.dueAt ?? null,
    location: input.location ?? null,
  };
}

function buildOptimisticTask(
  payload: ReturnType<typeof buildCreateTaskPayload>,
  optimisticId: string,
): Task {
  return {
    id: optimisticId,
    title: payload.title,
    notes: payload.notes,
    status: 'pending',
    priority: payload.priority,
    startAt: payload.startAt,
    dueAt: payload.dueAt,
    location: payload.location,
    completedAt: null,
    listTitle: null,
    createdAt: new Date().toISOString(),
  };
}

export function useTaskCreate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) =>
      remindersGateway.createReminder(buildCreateTaskPayload(input)),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      const optimisticId = `optimistic-task-${Date.now().toString()}`;
      const optimisticTask = buildOptimisticTask(buildCreateTaskPayload(input), optimisticId);

      const previousAll = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
      queryClient.setQueryData<TaskListItem[] | undefined>(taskKeys.all, (current) => [
        optimisticTask,
        ...(current ?? []),
      ]);

      return { optimisticId, previousAll };
    },
    onError: (_error, _input, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(taskKeys.all, context.previousAll);
    },
    onSuccess: (createdTask, _input, context) => {
      queryClient.setQueryData<TaskListItem[] | undefined>(taskKeys.all, (current) =>
        current?.map((task) => (task.id === context?.optimisticId ? createdTask : task)),
      );
      queryClient.setQueryData(taskKeys.detail(createdTask.id), { task: createdTask });
    },
  });
}
