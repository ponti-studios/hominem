import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Compatibility wrapper for old hono-based useHonoQuery hook
 * Adapts old API to new react-query pattern
 */
export function useHonoQuery<TData = unknown>(
  queryKey: unknown[],
  queryFn: (client: { finance: any }) => Promise<TData>,
  options?: Partial<UseQueryOptions<TData>>,
) {
  const client = useApiClient();

  return useQuery({
    queryKey,
    queryFn: () => queryFn({ finance: client.finance || client }),
    ...options,
  } as UseQueryOptions<TData>);
}

/**
 * Compatibility wrapper for old hono-based useHonoMutation hook
 * Adapts old API to new react-query mutation pattern
 */
export function useHonoMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (client: { finance: any }, variables: TVariables) => Promise<TData>,
  options?: any,
) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn({ finance: client.finance || client }, variables),
    onSuccess: (data) => {
      options?.onSuccess?.(data);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      options?.onError?.(error);
    },
    ...options,
  });
}

/**
 * Utility hooks for common client operations
 */
export const useHonoUtils = () => {
  const queryClient = useQueryClient();
  return {
    invalidateQueries: (queryKey?: unknown[]) => {
      if (queryKey) {
        return queryClient.invalidateQueries({ queryKey });
      }
      return queryClient.invalidateQueries();
    },
    setQueryData: (queryKey: unknown[], data: unknown) => {
      return queryClient.setQueryData(queryKey, data);
    },
  };
};
