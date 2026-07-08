import { useApiClient } from '@hominem/rpc/react';
import type { FinanceClient } from '@hominem/rpc/finance';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

function useFinanceClient(): FinanceClient {
  const client = useApiClient();
  return client.api.finance;
}

export function useHonoQuery<TData = unknown>(
  queryKey: unknown[],
  queryFn: (client: { finance: FinanceClient }) => Promise<TData>,
  options?: Partial<UseQueryOptions<TData>>,
) {
  const finance = useFinanceClient();

  return useQuery<TData>({
    queryKey,
    queryFn: () => queryFn({ finance }),
    ...options,
  });
}

export function useHonoMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (
    client: { finance: FinanceClient },
    variables: TVariables,
  ) => Promise<TData>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options?: any,
) {
  const finance = useFinanceClient();

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn({ finance }, variables),
    onSuccess: (data: TData) => {
      options?.onSuccess?.(data);
    },
    onError: (error: Error) => {
      options?.onError?.(error);
    },
    ...options,
  });
}

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
    setQueryData: (queryKey: unknown[], data: unknown) => queryClient.setQueryData(queryKey, data),
  };
}
