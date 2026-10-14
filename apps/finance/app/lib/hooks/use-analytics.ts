import { format } from 'date-fns';

import { useHonoQuery } from '~/lib/api';

type FinanceTagOption = {
  id: string;
  name: string;
};

type FinanceTagsOutput = Array<string | FinanceTagOption>;
type TagBreakdownOutput = {
  breakdown: Array<{
    tag: string;
    amount: number;
    percentage: number;
    transactionCount: number;
    currencyCode: string;
  }>;
  totalSpending: number | null;
  totalsByCurrency: Array<{ currencyCode: string; totalSpending: number; averagePerDay: number }>;
  averagePerDay: number | null;
  currencyCode: string | null;
  warnings: string[];
};

interface TagBreakdownParams {
  from?: Date | undefined;
  to?: Date | undefined;
  account?: string | undefined;
  tag?: string | undefined;
  limit?: number | undefined;
}

export function useTagBreakdown({ from, to, account, tag, limit = 5 }: TagBreakdownParams) {
  return useHonoQuery<TagBreakdownOutput>(
    [
      'finance',
      'analyze',
      'tag-breakdown',
      {
        from: from?.toISOString(),
        to: to?.toISOString(),
        account,
        tag,
        limit,
      },
    ],
    ({ finance }) =>
      finance.analyze['tag-breakdown']
        .$get({
          query: {
            ...(from ? { from: format(from, 'yyyy-MM-dd') } : {}),
            ...(to ? { to: format(to, 'yyyy-MM-dd') } : {}),
            ...(tag ? { tag } : {}),
            limit: String(limit),
          },
        })
        .then((r) => r.json()),
    {
      staleTime: 5 * 60 * 1000,
    },
  );
}

export function useFinanceTags() {
  return useHonoQuery<FinanceTagsOutput>(
    ['finance', 'tags', 'list'],
    ({ finance }) => finance.tags.list.$get({ query: {} }).then((r) => r.json()),
    {
      staleTime: 10 * 60 * 1000, // 10 minutes - tags don't change often
    },
  );
}
