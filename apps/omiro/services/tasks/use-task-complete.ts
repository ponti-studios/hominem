import { useMutation } from '@tanstack/react-query';

import { getTaskService } from './task-service-instance';

interface CompleteTaskInput {
  taskId: string;
  completed: boolean;
}

export function useTaskComplete() {
  return useMutation({
    mutationFn: async ({ taskId, completed }: CompleteTaskInput) =>
      getTaskService().complete(taskId, completed),
  });
}
