import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from './query-keys';
import { mapTaskDetail, mapTaskList } from './task-cache';
import type { Task, TaskDetailOutput, TaskListItem } from './task-types';

interface TaskPatchContext {
  taskId: string;
  previousAll: TaskListItem[] | undefined;
  previousDetail: TaskDetailOutput | undefined;
}

interface UseTaskPatchMutationOptions<TVariables> {
  mutationFn: (variables: TVariables) => Promise<Task>;
  getTaskId: (variables: TVariables) => string;
  applyOptimistic: <T extends Task>(task: T, variables: TVariables) => T;
}

// Shared cancel/snapshot/optimistic-apply/rollback skeleton used by every
// task mutation that patches a single existing task in place (update,
// complete).
export function useTaskPatchMutation<TVariables>({
  mutationFn,
  getTaskId,
  applyOptimistic,
}: UseTaskPatchMutationOptions<TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onMutate: async (variables: TVariables): Promise<TaskPatchContext> => {
      const taskId = getTaskId(variables);
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      const previousAll = queryClient.getQueryData<TaskListItem[]>(taskKeys.all);
      const previousDetail = queryClient.getQueryData<TaskDetailOutput>(taskKeys.detail(taskId));

      queryClient.setQueryData<TaskListItem[] | undefined>(taskKeys.all, (current) =>
        mapTaskList(current, taskId, (task) => applyOptimistic(task, variables)),
      );
      queryClient.setQueryData<TaskDetailOutput | undefined>(taskKeys.detail(taskId), (current) =>
        mapTaskDetail(current, taskId, (task) => applyOptimistic(task, variables)),
      );

      return { taskId, previousAll, previousDetail };
    },
    onError: (_error, _variables, context) => {
      if (!context) {
        return;
      }
      queryClient.setQueryData(taskKeys.all, context.previousAll);
      queryClient.setQueryData(taskKeys.detail(context.taskId), context.previousDetail);
    },
    onSuccess: (updatedTask) => {
      queryClient.setQueryData<TaskListItem[] | undefined>(taskKeys.all, (current) =>
        mapTaskList(current, updatedTask.id, (task) => ({ ...task, ...updatedTask })),
      );
      queryClient.setQueryData<TaskDetailOutput | undefined>(
        taskKeys.detail(updatedTask.id),
        (current) =>
          mapTaskDetail(current, updatedTask.id, (task) => ({ ...task, ...updatedTask })),
      );
    },
  });
}
