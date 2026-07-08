import type { MonthlyStatsOutput } from '@hominem/rpc/finance';

import { useHonoQuery } from '~/lib/api';

export type MonthlyStatsContract = MonthlyStatsOutput & {
  topTag?: string;
  tagSpending?: Array<{ name: string | null; amount: number }>;
};

/**
 * Custom hook to fetch monthly finance statistics using Hono RPC
 * @param month The month to fetch statistics for, in the format 'YYYY-MM'
 * @param options Additional options to pass to useQuery
 */
export function useMonthlyStats(month: string | undefined | null, options = {}) {
  const query = useHonoQuery<MonthlyStatsContract>(
    ['finance', 'analyze', 'monthly-stats', month],
    ({ finance }) =>
      finance.analyze['monthly-stats']
        .$get({ query: { month: month! } })
        .then((r) => r.json()) as Promise<MonthlyStatsContract>,
    {
      enabled: !!month,
      staleTime: 5 * 60 * 1000, // 5 minutes
      ...options,
    },
  );

  return {
    stats: query.data,
    isLoading: query.isLoading,
    error: query.error?.message,
    refetch: query.refetch,
  };
}
