import { useApiClient } from '@hominem/rpc/react';
import type { MonthlyUsageStatus } from '@hominem/rpc/types';
import { useQuery } from '@tanstack/react-query';

const monthlyUsageQueryKey = ['usage', 'monthly'] as const;

export const useMonthlyUsage = () => {
  const client = useApiClient();

  return useQuery<MonthlyUsageStatus>({
    queryKey: monthlyUsageQueryKey,
    queryFn: async () => {
      const res = await client.api.usage.monthly.$get();
      return res.json();
    },
  });
};
