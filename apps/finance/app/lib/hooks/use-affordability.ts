import type { AffordabilityCheckInput, AffordabilityCheckOutput } from '@hominem/rpc/finance';

import { useHonoMutation } from '~/lib/api';

export const useCheckAffordability = () => {
  return useHonoMutation<AffordabilityCheckOutput, AffordabilityCheckInput>(
    ({ finance }, variables) =>
      finance.affordability.check.$post({ json: variables }).then((r) => r.json()),
  );
};
