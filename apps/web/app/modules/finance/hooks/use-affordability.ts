import type { AffordabilityCheckInput, AffordabilityCheckOutput } from '@hominem/rpc/finance';

import { useFinanceMutation } from '~/modules/finance/lib/api';

export const useCheckAffordability = () => {
  return useFinanceMutation<AffordabilityCheckOutput, AffordabilityCheckInput>(
    ({ finance }, variables) =>
      finance.affordability.check.$post({ json: variables }).then((r) => r.json()),
  );
};
