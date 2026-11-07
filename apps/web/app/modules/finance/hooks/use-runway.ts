import type { RunwayCalculateInput, RunwayCalculateOutput } from '@hominem/rpc/finance';

import { useFinanceMutation } from '~/modules/finance/lib/api';

export const useCalculateRunway = () => {
  return useFinanceMutation<RunwayCalculateOutput, RunwayCalculateInput>(({ finance }, variables) =>
    finance.runway.calculate.$post({ json: variables }).then((r) => r.json()),
  );
};
