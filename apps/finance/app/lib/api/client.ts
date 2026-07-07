import { createFinanceClient } from '@hominem/rpc/domains/finance';
import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

function useFinanceClient() {
  const client = useApiClient();
  return createFinanceClient(client);
}

/**
 * Compatibility wrapper for old useHonoQuery hook — queries the finance domain.
 */
export function useHonoQuery<TData = unknown>(
  queryKey: unknown[],
  queryFn: (client: { finance: ReturnType<typeof createFinanceClient> }) => Promise<TData>,
  options?: Partial<UseQueryOptions<TData>>,
) {
  const financeClient = useFinanceClient();

  return useQuery({
    queryKey,
    queryFn: () => queryFn({ finance: financeClient }),
    ...options,
  } as UseQueryOptions<TData>);
}

/**
 * Compatibility wrapper for old useHonoMutation hook.
 */
export function useHonoMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (client: { finance: ReturnType<typeof createFinanceClient> }, variables: TVariables) => Promise<TData>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any,
) {
  const financeClient = useFinanceClient();

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn({ finance: financeClient }, variables),
    onSuccess: (data: TData) => {
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
    ...options,
  });
}

/**
 * Utility hooks for query cache operations.
 */
export function useHonoUtils() {
  const queryClient = useQueryClient();
  return {
    invalidate: (queryKey?: unknown[]) => {
      if (queryKey) return queryClient.invalidateQueries({ queryKey });
      return queryClient.invalidateQueries();
    },
    invalidateQueries: (queryKey?: unknown[]) => {
      if (queryKey) return queryClient.invalidateQueries({ queryKey });
      return queryClient.invalidateQueries();
    },
    setQueryData: (queryKey: unknown[], data: unknown) =>
      queryClient.setQueryData(queryKey, data),
  };
}
