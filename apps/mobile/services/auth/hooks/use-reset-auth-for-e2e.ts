import { useCallback } from 'react';

import { E2E_TESTING } from '~/constants';
import { clearPersistedSessionCookies } from '~/services/auth/session-cookie';
import type { AuthContext } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/local-store';

export function useResetAuthForE2E(dispatch: AuthContext['dispatch']) {
  const resetAuthForE2E = useCallback(async () => {
    if (!E2E_TESTING) return;
    await LocalStore.clearAllData();
    await clearPersistedSessionCookies();
    dispatch({ type: 'RESET_TO_SIGNED_OUT' });
  }, [dispatch]);

  return resetAuthForE2E;
}
