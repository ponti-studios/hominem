import { getCookie } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

const BETTER_AUTH_COOKIE_KEYS = ['mobile_cookie'] as const;
const SESSION_COOKIE_KEYS = ['mobile_session_cookie_v1'] as const;

export async function getPersistedSessionCookieHeader() {
  for (const key of SESSION_COOKIE_KEYS) {
    const storedHeader = await SecureStore.getItemAsync(key);
    if (storedHeader) {
      return storedHeader;
    }
  }

  for (const key of BETTER_AUTH_COOKIE_KEYS) {
    const betterAuthCookie = await SecureStore.getItemAsync(key);
    if (betterAuthCookie) {
      return getCookie(betterAuthCookie);
    }
  }

  return null;
}

export async function clearPersistedSessionCookies() {
  await Promise.all([
    ...SESSION_COOKIE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
    ...BETTER_AUTH_COOKIE_KEYS.map((key) => SecureStore.deleteItemAsync(key)),
  ]);
}
