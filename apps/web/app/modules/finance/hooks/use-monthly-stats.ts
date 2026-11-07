import type { MonthlyStatsOutput } from '@hominem/rpc/finance';

import { useFinanceQuery } from '~/modules/finance/lib/api';

export type MonthlyStatsContract = MonthlyStatsOutput;

// month is 'YYYY-MM'
export function useMonthlyStats(month: string | undefined | null, options = {}) {
  const query = useFinanceQuery<MonthlyStatsContract>(
    ['finance', 'analyze', 'monthly-stats', month],
    async ({ finance }) => {
      const response = await finance.analyze['monthly-stats'].$get({ query: { month: month! } });
      return response.json();
    },
    {
      enabled: !!month,
      staleTime: 5 * 60 * 1000,
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
