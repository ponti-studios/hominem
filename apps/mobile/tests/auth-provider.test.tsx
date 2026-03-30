import type { User } from '@hominem/auth';
import { act, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  runAuthBootMock,
  getPersistedSessionCookieHeaderMock,
  persistSessionCookieFromHeadersMock,
  clearPersistedSessionCookiesMock,
  passkeySignInMock,
  getUserProfileMock,
  upsertUserProfileMock,
  clearAllDataMock,
  captureAuthAnalyticsEventMock,
  captureAuthAnalyticsFailureMock,
  markStartupPhaseMock,
} = vi.hoisted(() => ({
  runAuthBootMock: vi.fn(),
  getPersistedSessionCookieHeaderMock: vi.fn(),
  persistSessionCookieFromHeadersMock: vi.fn(),
  clearPersistedSessionCookiesMock: vi.fn(),
  passkeySignInMock: vi.fn(),
  getUserProfileMock: vi.fn(),
  upsertUserProfileMock: vi.fn(),
  clearAllDataMock: vi.fn(),
  captureAuthAnalyticsEventMock: vi.fn(),
  captureAuthAnalyticsFailureMock: vi.fn(),
  markStartupPhaseMock: vi.fn(),
}));

vi.mock('../utils/auth/boot', () => ({
  runAuthBoot: runAuthBootMock,
}));

vi.mock('../utils/auth/session-cookie', () => ({
  getPersistedSessionCookieHeader: getPersistedSessionCookieHeaderMock,
  persistSessionCookieFromHeaders: persistSessionCookieFromHeadersMock,
  clearPersistedSessionCookies: clearPersistedSessionCookiesMock,
}));

vi.mock('../lib/auth-client', () => ({
  authClient: {
    signIn: {
      passkey: passkeySignInMock,
    },
  },
}));

vi.mock('../utils/local-store', () => ({
  LocalStore: {
    clearAllData: clearAllDataMock,
    getUserProfile: getUserProfileMock,
    upsertUserProfile: upsertUserProfileMock,
  },
}));

vi.mock('../utils/auth/auth-analytics', () => ({
  captureAuthAnalyticsEvent: captureAuthAnalyticsEventMock,
  captureAuthAnalyticsFailure: captureAuthAnalyticsFailureMock,
}));

vi.mock('../utils/performance/startup-metrics', () => ({
  markStartupPhase: markStartupPhaseMock,
}));

vi.mock('../utils/constants', () => ({
  API_BASE_URL: 'http://localhost:4040',
  E2E_TESTING: false,
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn().mockResolvedValue('1'),
  setItemAsync: vi.fn().mockResolvedValue(undefined),
  deleteItemAsync: vi.fn().mockResolvedValue(undefined),
}));

import { AuthProvider, useAuth } from '../utils/auth-provider';

const baseUser: User = {
  id: 'user-1',
  email: 'mobile-test@hominem.test',
  name: 'Mobile Test User',
  createdAt: '2026-03-01T00:00:00.000Z',
  updatedAt: '2026-03-01T00:00:00.000Z',
};

let latestAuthContext: ReturnType<typeof useAuth> | null = null;

function AuthProbe() {
  latestAuthContext = useAuth();
  return null;
}

async function renderAuthProvider() {
  latestAuthContext = null;

  let rendered: ReturnType<typeof render> | null = null;
  await act(async () => {
    rendered = render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
  });

  return rendered;
}

describe('mobile AuthProvider', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    runAuthBootMock.mockResolvedValue({ type: 'SESSION_EXPIRED' });
    getPersistedSessionCookieHeaderMock.mockResolvedValue(null);
    persistSessionCookieFromHeadersMock.mockResolvedValue('session=fresh');
    clearPersistedSessionCookiesMock.mockResolvedValue(undefined);
    passkeySignInMock.mockResolvedValue({ data: { user: baseUser }, error: null });
    getUserProfileMock.mockResolvedValue(baseUser);
    upsertUserProfileMock.mockImplementation(async (user: User) => user);
    clearAllDataMock.mockResolvedValue(true);
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    latestAuthContext = null;
    globalThis.fetch = originalFetch;
  });

  it('recovers the signed-in session on boot and reuses the recovered cookie for auth headers', async () => {
    runAuthBootMock.mockResolvedValueOnce({
      type: 'SESSION_LOADED',
      user: baseUser,
      tokens: { sessionCookieHeader: 'session=boot' },
    });

    await renderAuthProvider();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_in');
      expect(latestAuthContext?.currentUser?.email).toBe(baseUser.email);
    });

    await expect(latestAuthContext?.getAuthHeaders()).resolves.toEqual({ cookie: 'session=boot' });
    expect(getPersistedSessionCookieHeaderMock).not.toHaveBeenCalled();
  });

  it('verifies email OTP by persisting the returned cookie and authenticated user', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'set-cookie': 'session=fresh; Path=/; HttpOnly' }),
      json: async () => ({
        isAuthenticated: true,
        user: {
          ...baseUser,
          createdAt: new Date(baseUser.createdAt),
          updatedAt: new Date(baseUser.updatedAt),
        },
      }),
    } as Response);

    await renderAuthProvider();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_out');
    });

    await act(async () => {
      await latestAuthContext?.verifyEmailOtp({
        email: baseUser.email,
        otp: '123456',
        name: baseUser.name,
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4040/api/auth/email-otp/verify',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: baseUser.email,
          otp: '123456',
          name: baseUser.name,
        }),
      }),
    );
    expect(persistSessionCookieFromHeadersMock).toHaveBeenCalledTimes(1);
    expect(upsertUserProfileMock).toHaveBeenCalledWith({
      ...baseUser,
      image: undefined,
    });

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_in');
      expect(latestAuthContext?.currentUser?.email).toBe(baseUser.email);
    });

    await expect(latestAuthContext?.getAuthHeaders()).resolves.toEqual({ cookie: 'session=fresh' });
  });

  it('fails closed when OTP verification does not return a session cookie', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    persistSessionCookieFromHeadersMock.mockResolvedValueOnce(null);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({
        isAuthenticated: true,
        user: baseUser,
      }),
    } as Response);

    await renderAuthProvider();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_out');
    });

    let thrown: Error | null = null;
    await act(async () => {
      try {
        await latestAuthContext?.verifyEmailOtp({
          email: baseUser.email,
          otp: '123456',
        });
      } catch (error) {
        thrown = error as Error;
      }
    });

    expect(thrown?.message).toBe('Verification succeeded but no session cookie was returned');
    expect(upsertUserProfileMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('otp_requested');
      expect(latestAuthContext?.currentUser).toBeNull();
      expect(latestAuthContext?.authError?.message).toBe(
        'Verification succeeded but no session cookie was returned',
      );
    });
  });

  it('requires a persisted Better Auth cookie before treating passkey sign-in as authenticated', async () => {
    getPersistedSessionCookieHeaderMock.mockResolvedValueOnce(null);

    await renderAuthProvider();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_out');
    });

    let thrown: Error | null = null;
    await act(async () => {
      try {
        await latestAuthContext?.signInWithPasskey();
      } catch (error) {
        thrown = error as Error;
      }
    });

    expect(passkeySignInMock).toHaveBeenCalledTimes(1);
    expect(thrown?.message).toBe('Missing Better Auth session cookie after passkey sign-in');
    expect(upsertUserProfileMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('degraded');
      expect(latestAuthContext?.currentUser).toBeNull();
    });
  });

  it('signs out only after remote invalidation succeeds, then clears local auth state', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    runAuthBootMock.mockResolvedValueOnce({
      type: 'SESSION_LOADED',
      user: baseUser,
      tokens: { sessionCookieHeader: 'session=boot' },
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response);

    await renderAuthProvider();

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_in');
    });

    await act(async () => {
      await latestAuthContext?.signOut();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:4040/api/auth/logout',
      expect.objectContaining({
        method: 'POST',
        headers: { cookie: 'session=boot' },
      }),
    );
    expect(clearPersistedSessionCookiesMock).toHaveBeenCalledTimes(1);
    expect(clearAllDataMock).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(latestAuthContext?.authStatus).toBe('signed_out');
      expect(latestAuthContext?.currentUser).toBeNull();
    });

    await expect(latestAuthContext?.getAuthHeaders()).resolves.toEqual({});
  });
});
