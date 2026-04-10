import type { RefObject } from 'react';
import { useCallback } from 'react';

import { getPersistedSessionCookieHeader } from '~/services/auth/session-cookie';

export function useAuthHeaders(sessionCookieHeaderRef: RefObject<string | null>) {
  const getAuthHeaders = useCallback(async () => {
    const sessionCookieHeader =
      sessionCookieHeaderRef.current ?? (await getPersistedSessionCookieHeader());
    if (sessionCookieHeader) {
      sessionCookieHeaderRef.current = sessionCookieHeader;
      return { cookie: sessionCookieHeader } satisfies Record<string, string>;
    }

    return {} as Record<string, string>;
  }, [sessionCookieHeaderRef]);

  return getAuthHeaders;
}