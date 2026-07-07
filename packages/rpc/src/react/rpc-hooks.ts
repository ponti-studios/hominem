import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
} from '@tanstack/react-query'

import { createFinanceClient, type FinanceClient } from '../domains/finance'
import { useApiClient } from './context'

type RpcClients = {
  finance: FinanceClient
}

function useRpcClients(): RpcClients {
  const apiClient = useApiClient()
  return {
    finance: createFinanceClient(apiClient),
  }
}

export function useRpcQuery<TQueryFnData, TError = Error, TData = TQueryFnData>(
  queryFn: (clients: RpcClients) => Promise<TQueryFnData>,
  options?: UseQueryOptions<TQueryFnData, TError, TData>,
) {
  const clients = useRpcClients()
  const { queryKey, ...queryOptions } = options ?? {}

  return useQuery<TQueryFnData, TError, TData>({
    ...queryOptions,
    queryKey: queryKey ?? ['rpc'],
    queryFn: () => queryFn(clients),
  })
}

export function useRpcMutation<TData, TVariables, TError = Error>(
  mutationFn: (clients: RpcClients, variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, TError, TVariables>,
) {
  const clients = useRpcClients()

  return useMutation<TData, TError, TVariables>({
    ...options,
    mutationFn: (variables) => mutationFn(clients, variables),
  })
}
