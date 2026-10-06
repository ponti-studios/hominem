import { useQuery } from '@tanstack/react-query';

import { taskKeys } from './query-keys';
import { getTaskService } from './task-service-instance';
import type { TaskListItem } from './task-types';

// Reads the local database, so it answers at once and offline. The sync
// provider refreshes it whenever the data changes; `refetch` also asks the
// server for anything new first (pull to refresh).
export function useTasksQuery({ enabled = true }: { enabled?: boolean } = {}) {
  const query = useQuery<TaskListItem[]>({
    queryKey: taskKeys.all,
    queryFn: () => getTaskService().list(),
    enabled,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    networkMode: 'always',
  });

  return {
    ...query,
    refetch: async () => {
      await getTaskService().sync();
      return query.refetch();
    },
  };
}
