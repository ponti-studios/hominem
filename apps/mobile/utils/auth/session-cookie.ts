import { getSetCookie } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

import { AUTH_CLIENT_STORAGE_PREFIX, authClient } from '~/lib/auth-client';

const BETTER_AUTH_COOKIE_KEY = `${AUTH_CLIENT_STORAGE_PREFIX}_cookie`;
const BETTER_AUTH_SESSION_CACHE_KEY = `${AUTH_CLIENT_STORAGE_PREFIX}_session_data`;

export async function getPersistedSessionCookieHeader() {
  const cookieHeader = authClient.getCookie();
  return cookieHeader.length > 0 ? cookieHeader : null;
}

export async function persistSessionCookieFromHeaders(headers: Headers) {
  const setCookieHeader = headers.get('set-cookie');
  if (!setCookieHeader) {
    return null;
  }

  const previousCookieState = await SecureStore.getItemAsync(BETTER_AUTH_COOKIE_KEY);
  const nextCookieState = getSetCookie(setCookieHeader, previousCookieState ?? undefined);
  await SecureStore.setItemAsync(BETTER_AUTH_COOKIE_KEY, nextCookieState);

  const cookieHeader = authClient.getCookie();
  return cookieHeader.length > 0 ? cookieHeader : null;
}

export async function clearPersistedSessionCookies() {
  await Promise.all([
    SecureStore.deleteItemAsync(BETTER_AUTH_COOKIE_KEY),
    SecureStore.deleteItemAsync(BETTER_AUTH_SESSION_CACHE_KEY),
  ]);
}
