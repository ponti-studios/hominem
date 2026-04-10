import { getCookie } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

const BETTER_AUTH_COOKIE_KEY = 'hominem_cookie';
const LEGACY_MOBILE_SESSION_COOKIE_KEY = 'hominem_mobile_session_cookie_v1';

export async function getPersistedSessionCookieHeader() {
  const storedHeader = await SecureStore.getItemAsync(LEGACY_MOBILE_SESSION_COOKIE_KEY);
  if (storedHeader) {
    return storedHeader;
  }

  const betterAuthCookie = await SecureStore.getItemAsync(BETTER_AUTH_COOKIE_KEY);
  if (!betterAuthCookie) {
    return null;
  }

  return getCookie(betterAuthCookie);
}

export async function clearPersistedSessionCookies() {
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_MOBILE_SESSION_COOKIE_KEY),
    SecureStore.deleteItemAsync(BETTER_AUTH_COOKIE_KEY),
  ]);
}
