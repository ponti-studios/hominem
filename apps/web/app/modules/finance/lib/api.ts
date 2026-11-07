import type { HonoClient } from '@hominem/rpc';
import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';

// The platform HonoClient already exposes `api.finance`; the standalone Finance
// app built its own client with a different base path, so use the platform's
// client type rather than the `/api/finance`-rooted one from @hominem/rpc/finance.
export type FinanceClient = HonoClient['api']['finance'];

// Keeping the accessor here means the ported hooks and components do not care
// where the client comes from.
export function useFinanceApiClient(): FinanceClient {
  return useApiClient().api.finance;
}

export function useFinanceQuery<TData = unknown>(
  queryKey: unknown[],
  queryFn: (client: { finance: FinanceClient }) => Promise<TData>,
  options?: Partial<UseQueryOptions<TData>>,
) {
  const finance = useFinanceApiClient();

  return useQuery<TData>({
    queryKey,
    queryFn: () => queryFn({ finance }),
    ...options,
  });
}

export function useFinanceMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (client: { finance: FinanceClient }, variables: TVariables) => Promise<TData>,
) {
  const finance = useFinanceApiClient();

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn({ finance }, variables),
  });
}
