import type { RunwayCalculateInput, RunwayCalculateOutput } from '@hominem/rpc/finance';

import { useHonoMutation } from '~/lib/api';

export const useCalculateRunway = () => {
  return useHonoMutation<RunwayCalculateOutput, RunwayCalculateInput>(
    ({ finance }, variables) =>
      finance.runway.calculate
        .$get({
          query: {
            balance: String(variables.balance),
            monthlyExpenses: String(variables.monthlyExpenses),
            ...(variables.plannedPurchases && {
              plannedPurchases: variables.plannedPurchases,
            }),
            ...(variables.projectionMonths !== undefined && {
              projectionMonths: String(variables.projectionMonths),
            }),
          },
        })
        .then((r) => r.json()),
  );
};
