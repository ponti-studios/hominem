import type { QueryClient } from '@tanstack/react-query';

export const financeRulingsCurrentQueryKey = ['finance', 'rulings', 'current'] as const;

/** Prevent an older in-flight read from replacing the preparation just created. */
export async function cachePreparedRulings<T>(queryClient: QueryClient, data: T) {
  await queryClient.cancelQueries({ queryKey: financeRulingsCurrentQueryKey });
  queryClient.setQueryData(financeRulingsCurrentQueryKey, data);
}
