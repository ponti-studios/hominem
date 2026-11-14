import type {
  AffordabilityCheckInput,
  AffordabilityCheckOutput,
  AffordabilityContextOutput,
  RunwayCurrencyInput,
} from '@hominem/rpc/finance';
import { useApiClient } from '@hominem/rpc/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useFinanceQuery } from '~/modules/finance/lib/api';

const affordabilityContextKey = ['finance', 'affordability', 'context'];

async function assertResponse(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body: unknown = await response.json().catch(() => ({}));
  const message =
    typeof body === 'object' &&
    body !== null &&
    'message' in body &&
    typeof body.message === 'string'
      ? body.message
      : fallback;
  throw new Error(message);
}

export function useAffordabilityContext() {
  return useFinanceQuery<AffordabilityContextOutput>(
    affordabilityContextKey,
    async ({ finance }) => {
      const response = await finance.affordability.context.$get();
      await assertResponse(response, 'Unable to load Finance data.');
      return response.json();
    },
  );
}

export function useSaveAffordabilityCurrency() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RunwayCurrencyInput) => {
      const response = await client.api.finance.runway.settings.currency.$post({ json: input });
      await assertResponse(response, 'Unable to save the Finance currency.');
      return response.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: affordabilityContextKey });
      void queryClient.invalidateQueries({ queryKey: ['finance', 'runway-settings'] });
    },
  });
}

export function useCheckAffordability() {
  const client = useApiClient();

  return useMutation<AffordabilityCheckOutput, Error, AffordabilityCheckInput>({
    mutationFn: async (input) => {
      const response = await client.api.finance.affordability.check.$post({ json: input });
      await assertResponse(response, 'Unable to check this purchase.');
      return response.json();
    },
  });
}
