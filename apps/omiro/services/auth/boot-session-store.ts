import { getPersistedSessionCookieHeader } from '~/services/auth/session-cookie';

export function getStoredSessionTokens() {
  return getPersistedSessionCookieHeader().then((sessionCookieHeader) => ({ sessionCookieHeader }));
}
