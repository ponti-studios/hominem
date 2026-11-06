import type { RunwaySettingsOutput } from '@hominem/rpc/finance';

import { useFinanceQuery } from '~/modules/finance/lib/api';

export type RunwaySettings = RunwaySettingsOutput;

export function useRunwaySettings() {
  return useFinanceQuery(['finance', 'runway-settings'], ({ finance }) =>
    finance.runway.settings.$get().then((response) => response.json()),
  );
}
