import type { RunwaySettingsOutput } from '@hominem/rpc/finance';

import { useHonoQuery } from '~/lib/api';

export type RunwaySettings = RunwaySettingsOutput;

export function useRunwaySettings() {
  return useHonoQuery(['finance', 'runway-settings'], ({ finance }) =>
    finance.runway.settings.$get().then((response) => response.json()),
  );
}
