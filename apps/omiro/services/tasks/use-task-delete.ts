import { useMutation } from '@tanstack/react-query';

import { getTaskService } from './task-service-instance';

export function useTaskDelete() {
  return useMutation({
    mutationFn: async (taskId: string) => getTaskService().remove(taskId),
  });
}
