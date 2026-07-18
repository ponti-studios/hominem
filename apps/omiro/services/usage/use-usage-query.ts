import { queryKeys, useApiClient } from '@hominem/rpc/react';
import type { MonthlyUsageStatus } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

export const useMonthlyUsage = () => {
  const client = useApiClient();

  return useQuery<MonthlyUsageStatus>({
    queryKey: queryKeys.usage.monthly,
    queryFn: async () => {
      const res = await client.api.usage.monthly.$get();
      return res.json();
    },
  });
};
