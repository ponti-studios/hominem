import { useCallback } from 'react';

import { E2E_TESTING } from '~/constants';
import { authClient } from '~/services/auth/auth-client';
import { clearPendingAuthEmail } from '~/services/auth/pending-email';
import { LocalStore } from '~/services/storage/local-store';

export function useResetAuthForE2E() {
  return useCallback(async () => {
    if (!E2E_TESTING) return;
    await authClient.signOut();
    clearPendingAuthEmail();
    await LocalStore.clearAllData();
  }, []);
}
