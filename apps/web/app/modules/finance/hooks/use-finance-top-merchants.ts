import type { TopMerchantsOutput } from '@hominem/rpc/finance';

import { useFinanceQuery } from '~/modules/finance/lib/api';

type UseFinanceTopMerchantsParams = {
  from?: string | undefined;
  to?: string | undefined;
  account?: string | undefined;
  tag?: string | undefined;
  limit?: number | undefined;
};

export function useFinanceTopMerchants({
  from,
  to,
  account,
  tag,
  limit,
}: UseFinanceTopMerchantsParams) {
  return useFinanceQuery<TopMerchantsOutput>(
    ['finance', 'analyze', 'top-merchants', { from, to, account, tag, limit }],
    ({ finance }) =>
      finance.analyze['top-merchants']
        .$get({
          query: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(account ? { account } : {}),
            ...(tag ? { tag } : {}),
            ...(typeof limit === 'number' ? { limit: String(limit) } : {}),
          },
        })
        .then((r) => r.json()),
    {
      staleTime: 5 * 60 * 1000,
    },
  );
}
