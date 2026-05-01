import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
  type QueryKey,
} from '@tanstack/react-query';

import type { InboxOutput } from '../types/inbox.types';
import type { HonoClient } from '../core/api-client';

import { useApiClient } from './context';

export interface OptimisticUpdateConfig<
  TData,
  TVariables,
  TContext = { previousData: TData | undefined }
> {
  queryKey: QueryKey;
  mutationFn: (client: HonoClient, variables: TVariables) => Promise<TData>;
  updateFn: (oldData: TData | undefined, variables: TVariables) => TData;
  onSuccess?: (data: TData, variables: TVariables, context: TContext) => void;
  onError?: (error: Error, variables: TVariables, context: TContext | undefined) => void;
}

export function useRpcQuery<TData>(
  queryFn: (client: HonoClient) => Promise<TData>,
  options: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'> & { queryKey: QueryKey },
) {
  const client = useApiClient();
  const { queryKey, ...queryOptions } = options;
  return useQuery({ queryKey, queryFn: () => queryFn(client), ...queryOptions });
}

export function useRpcMutation<TData, TVariables = void>(
  mutationFn: (client: HonoClient, variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, Error, TVariables>, 'mutationFn'> & {
    invalidateKeys?: QueryKey[];
  },
) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { invalidateKeys, onSuccess, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn: (variables: TVariables) => mutationFn(client, variables),
    ...mutationOptions,
    onSuccess: (data, variables, context, mutationContext) => {
      if (invalidateKeys) {
        invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      }
      if (onSuccess) {
        onSuccess(data, variables, context, mutationContext);
      }
    },
  });
}

interface UseInboxOptions {
  limit?: number;
}

export function useInbox(options: UseInboxOptions = {}) {
  return useRpcQuery(
    async (client) => {
      const query: { limit?: string } = {};
      if (options.limit) query.limit = String(options.limit);
      const res = await client.api.inbox.$get({ query });
      return res.json() as Promise<InboxOutput>;
    },
    {
      queryKey: ['inbox', options],
      staleTime: 1000 * 30,
    },
  );
}
