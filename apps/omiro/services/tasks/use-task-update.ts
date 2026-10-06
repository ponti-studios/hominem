import { useMutation } from '@tanstack/react-query';

import { getTaskService } from './task-service-instance';
import type { Task } from './task-types';

interface UpdateTaskInput {
  taskId: string;
  patch: Partial<Pick<Task, 'title' | 'notes' | 'startAt' | 'dueAt' | 'location'>>;
}

// Edits the local task and queues the change; a task with no date can be
// given one, and a date can be taken away.
export function useTaskUpdate() {
  return useMutation({
    mutationFn: async ({ taskId, patch }: UpdateTaskInput) =>
      getTaskService().update(taskId, patch),
  });
}
