import { useApiClient } from '@hominem/rpc/react';
import type { TaskDetailOutput } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

import { taskKeys } from './query-keys';

export function useTaskQuery({ taskId, enabled = true }: { taskId: string; enabled?: boolean }) {
  const client = useApiClient();

  return useQuery<TaskDetailOutput>({
    queryKey: taskKeys.detail(taskId),
    queryFn: async () => {
      const res = await client.api.tasks[':id'].$get({ param: { id: taskId } });
      return res.json();
    },
    enabled: enabled && taskId.length > 0,
  });
}
