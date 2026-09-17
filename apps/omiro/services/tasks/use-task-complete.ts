import { remindersGateway } from './reminders-gateway';
import type { Task } from './task-types';
import { useTaskPatchMutation } from './use-task-patch-mutation';

interface CompleteTaskInput {
  taskId: string;
  completed: boolean;
}

function applyCompleted<T extends Task>(task: T, { completed }: CompleteTaskInput): T {
  return {
    ...task,
    status: completed ? 'completed' : 'pending',
    completedAt: completed ? new Date().toISOString() : null,
  };
}

export function useTaskComplete() {
  return useTaskPatchMutation<CompleteTaskInput>({
    mutationFn: ({ taskId, completed }) => remindersGateway.completeReminder(taskId, completed),
    getTaskId: (input) => input.taskId,
    applyOptimistic: applyCompleted,
  });
}
