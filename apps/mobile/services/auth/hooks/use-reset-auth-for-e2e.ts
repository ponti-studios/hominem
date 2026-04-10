import { useCallback } from 'react';

import type { AuthContext } from '~/services/auth/types';
import { clearPersistedSessionCookies } from '~/services/auth/session-cookie';
import { LocalStore } from '~/services/storage/sqlite';
import { E2E_TESTING } from '~/constants';

export function useResetAuthForE2E(dispatch: AuthContext['dispatch']) {
  const resetAuthForE2E = useCallback(async () => {
    if (!E2E_TESTING) return;
    await LocalStore.clearAllData();
    await clearPersistedSessionCookies();
    dispatch({ type: 'RESET_TO_SIGNED_OUT' });
  }, [dispatch]);

  return resetAuthForE2E;
}
