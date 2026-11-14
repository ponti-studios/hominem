import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { cachePreparedRulings, financeRulingsCurrentQueryKey } from './rulings-query';

describe('Finance rulings query cache', () => {
  it('keeps a new preparation when an older current request finishes late', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    let resolveOld!: (value: { preparationId: string }) => void;
    const oldQuery = vi.fn(
      () =>
        new Promise<{ preparationId: string }>((resolve) => {
          resolveOld = resolve;
        }),
    );
    const pendingRead = queryClient.fetchQuery({
      queryKey: financeRulingsCurrentQueryKey,
      queryFn: oldQuery,
    });
    await vi.waitFor(() => expect(oldQuery).toHaveBeenCalledOnce());

    const fresh = { preparationId: 'fresh-preparation' };
    await cachePreparedRulings(queryClient, fresh);
    resolveOld({ preparationId: 'old-empty-preparation' });
    await pendingRead.catch(() => undefined);

    expect(queryClient.getQueryData(financeRulingsCurrentQueryKey)).toEqual(fresh);
    queryClient.clear();
  });
});
