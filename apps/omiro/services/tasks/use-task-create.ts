import { useMutation } from '@tanstack/react-query';

import { askForReminders } from './notifications/reminder-access';
import { getTaskService } from './task-service-instance';
import type { TaskPriority } from './task-types';

interface CreateTaskInput {
  title: string;
  notes?: string | null;
  priority?: TaskPriority;
  startAt?: string | null;
  dueAt?: string | null;
  location?: string | null;
}

// Writes to the local database and queues the change for the server, so it
// succeeds offline. A task with no date waits in the inbox.
export function useTaskCreate() {
  return useMutation({
    mutationFn: async ({ title, notes, startAt, dueAt, location }: CreateTaskInput) =>
      getTaskService().create({ title, notes, startAt, dueAt, location }),
    onSuccess: (task) => {
      void askForReminders(task);
    },
  });
}
