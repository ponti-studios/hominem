import type { AffordabilityCheckInput, AffordabilityCheckOutput } from '@hominem/rpc/finance';

import { useHonoMutation } from '~/lib/api';

export const useCheckAffordability = () => {
  return useHonoMutation<AffordabilityCheckOutput, AffordabilityCheckInput>(
    ({ finance }, variables) =>
      finance.affordability.check
        .$get({
          query: {
            purchaseAmount: String(variables.purchaseAmount),
            currentBalance: String(variables.currentBalance),
            monthlyIncome: String(variables.monthlyIncome),
            monthlyExpenses: String(variables.monthlyExpenses),
            ...(variables.emergencyFundTarget !== undefined && {
              emergencyFundTarget: String(variables.emergencyFundTarget),
            }),
          },
        })
        .then((r) => r.json()),
  );
};
