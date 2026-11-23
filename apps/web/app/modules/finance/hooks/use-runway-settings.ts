import { useFinanceQuery } from '~/modules/finance/lib/api';

export function useRunwaySettings() {
  return useFinanceQuery(['finance', 'runway-settings'], ({ finance }) =>
    finance.runway.settings.$get().then((response) => response.json()),
  );
}
