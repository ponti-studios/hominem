import type { RunwayCalculateInput, RunwayCalculateOutput } from '@hominem/rpc/finance';

import { useHonoMutation } from '~/lib/api';

export const useCalculateRunway = () => {
  return useHonoMutation<RunwayCalculateOutput, RunwayCalculateInput>(({ finance }, variables) =>
    finance.calculateRunway(variables),
  );
};
