import { useCallback } from 'react';

import { authClient } from '~/services/auth/auth-client';

export function useAuthHeaders() {
  return useCallback(async () => {
    const cookie = await Promise.resolve(authClient.getCookie());
    const headers: Record<string, string> = cookie ? { cookie } : {};
    return headers;
  }, []);
}
