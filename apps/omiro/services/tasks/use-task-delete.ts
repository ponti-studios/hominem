import { useMutation, useQueryClient } from '@tanstack/react-query';

import { taskKeys } from './query-keys';
import { remindersGateway } from './reminders-gateway';
import type { TaskListItem } from './task-types';

export function useTaskDelete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => remindersGateway.deleteReminder(taskId),
    onSuccess: (_result, taskId) => {
      queryClient.setQueryData<TaskListItem[] | undefined>(taskKeys.all, (current) =>
        current?.filter((task) => task.id !== taskId),
      );
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });
    },
  });
}
