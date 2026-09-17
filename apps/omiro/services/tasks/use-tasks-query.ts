import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { taskKeys } from './query-keys';
import { remindersGateway } from './reminders-gateway';
import type { TaskListItem } from './task-types';

export function useTasksQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const subscription = remindersGateway.subscribeToStoreChange(() => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);

  return useQuery<TaskListItem[]>({
    queryKey: taskKeys.all,
    queryFn: () => remindersGateway.listReminders(),
    enabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
