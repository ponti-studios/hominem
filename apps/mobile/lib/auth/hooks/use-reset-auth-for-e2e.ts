import { useCallback } from 'react';

import type { AuthEvent, AuthContext } from '~/auth/types';
import { clearPersistedSessionCookies } from '~/auth/session-cookie';
import { LocalStore } from '~/storage/sqlite';
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