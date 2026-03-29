import { beforeEach, describe, expect, mock, test } from 'bun:test';

const storage = new Map<string, string>();
let currentCookieHeader = '';

mock.module('expo-secure-store', () => ({
  getItemAsync: async (key: string) => storage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    storage.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    storage.delete(key);
  },
}));

mock.module('~/lib/auth-client', () => ({
  AUTH_CLIENT_STORAGE_PREFIX: 'hominem',
  authClient: {
    getCookie: () => currentCookieHeader,
  },
}));

mock.module('@better-auth/expo/client', () => ({
  expoClient: (config: unknown) => ({
    name: 'expoClient',
    config,
  }),
  getSetCookie: (_setCookieHeader: string, _prevCookie?: string) =>
    JSON.stringify({
      'better-auth.session_token': {
        value: 'next-token',
        expires: null,
      },
    }),
}));

describe('session-cookie helpers', () => {
  beforeEach(() => {
    storage.clear();
    currentCookieHeader = '';
  });

  test('reads the cookie header from the Better Auth Expo client', async () => {
    currentCookieHeader = 'better-auth.session_token=stored-token';

    const { getPersistedSessionCookieHeader } = await import('./session-cookie');

    await expect(getPersistedSessionCookieHeader()).resolves.toBe(
      'better-auth.session_token=stored-token',
    );
  });

  test('persists Better Auth cookie storage from response headers', async () => {
    currentCookieHeader = 'better-auth.session_token=next-token';
    const { persistSessionCookieFromHeaders } = await import('./session-cookie');

    const cookieHeader = await persistSessionCookieFromHeaders(
      new Headers({
        'set-cookie': 'better-auth.session_token=next-token; Path=/; HttpOnly',
      }),
    );

    expect(cookieHeader).toBe('better-auth.session_token=next-token');
    expect(storage.get('hominem_cookie')).toBe(
      JSON.stringify({
        'better-auth.session_token': {
          value: 'next-token',
          expires: null,
        },
      }),
    );
  });

  test('clears Better Auth cookie and session cache keys', async () => {
    storage.set('hominem_cookie', 'cookie-state');
    storage.set('hominem_session_data', 'session-cache');

    const { clearPersistedSessionCookies } = await import('./session-cookie');
    await clearPersistedSessionCookies();

    expect(storage.has('hominem_cookie')).toBe(false);
    expect(storage.has('hominem_session_data')).toBe(false);
  });
});
