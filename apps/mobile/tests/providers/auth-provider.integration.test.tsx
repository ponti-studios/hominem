import { screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import {
  mockAuthBootSignedIn,
  mockAuthBootSignedOut,
  mockSendVerificationOtpError,
  mockSendVerificationOtpSuccess,
  mockSignOutError,
  mockSignOutSuccess,
  mockVerifyEmailOtpError,
  mockVerifyEmailOtpSuccess,
} from '../support/auth-msw';
import { mswServer } from '../support/msw-server';
import { press, renderScreen } from '../support/render';

const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>();
const mockSetItemAsync = jest.fn<Promise<void>, [string, string]>();
const mockDeleteItemAsync = jest.fn<Promise<void>, [string]>();
const mockUpsertUserProfile = jest.fn();
const mockClearAllData = jest.fn();
const mockGetUserProfile = jest.fn();
const mockCapture = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('@better-auth/expo/client', () => ({
  getCookie: (value: string) => value,
}));

jest.mock('~/lib/auth-client', () => {
  const buildJsonRequest = async (
    path: string,
    input: {
      method: string;
      body?: unknown;
      signal?: AbortSignal;
      headers?: Record<string, string>;
    },
  ) => {
    const response = await fetch(new URL(path, 'http://localhost:4040').toString(), {
      method: input.method,
      headers: {
        'content-type': 'application/json',
        ...input.headers,
      },
      ...(input.body ? { body: JSON.stringify(input.body) } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });

    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      return {
        data: null,
        error: {
          status: response.status,
          message: (payload as { message?: string } | null)?.message ?? 'Request failed',
        },
      };
    }

    return {
      data: payload,
      error: null,
    };
  };

  return {
    authClient: {
      getSession: ({
        fetchOptions,
      }: { fetchOptions?: { signal?: AbortSignal; headers?: Record<string, string> } } = {}) =>
        buildJsonRequest('/api/auth/get-session', {
          method: 'GET',
          signal: fetchOptions?.signal,
          headers: fetchOptions?.headers,
        }),
      signOut: () => buildJsonRequest('/api/auth/sign-out', { method: 'POST' }),
      emailOtp: {
        sendVerificationOtp: ({
          email,
          type,
          fetchOptions,
        }: {
          email: string;
          type: string;
          fetchOptions?: { signal?: AbortSignal };
        }) =>
          buildJsonRequest('/api/auth/email-otp/send-verification-otp', {
            method: 'POST',
            body: { email, type },
            signal: fetchOptions?.signal,
          }),
      },
      signIn: {
        emailOtp: ({
          email,
          otp,
          name,
          fetchOptions,
        }: {
          email: string;
          otp: string;
          name?: string;
          fetchOptions?: { signal?: AbortSignal };
        }) =>
          buildJsonRequest('/api/auth/sign-in/email-otp', {
            method: 'POST',
            body: {
              email,
              otp,
              ...(name ? { name } : {}),
            },
            signal: fetchOptions?.signal,
          }),
      },
    },
  };
});

jest.mock('expo-secure-store', () => ({
  getItemAsync: (...args: [string]) => mockGetItemAsync(...args),
  setItemAsync: (...args: [string, string]) => mockSetItemAsync(...args),
  deleteItemAsync: (...args: [string]) => mockDeleteItemAsync(...args),
}));

jest.mock('~/utils/constants', () => ({
  API_BASE_URL: 'http://localhost:4040',
  APP_SCHEME: 'hakumi-test',
  APP_VARIANT: 'test',
  E2E_TESTING: false,
}));

jest.mock('~/utils/local-store', () => ({
  LocalStore: {
    upsertUserProfile: (...args: unknown[]) => mockUpsertUserProfile(...args),
    clearAllData: (...args: unknown[]) => mockClearAllData(...args),
    getUserProfile: (...args: unknown[]) => mockGetUserProfile(...args),
  },
}));

jest.mock('~/lib/posthog', () => ({
  posthog: {
    capture: (...args: unknown[]) => mockCapture(...args),
    captureException: (...args: unknown[]) => mockCaptureException(...args),
    identify: jest.fn(),
    reset: jest.fn(),
  },
}));

import { AuthProvider, useAuth } from '../../utils/auth-provider';

function Probe() {
  const auth = useAuth();

  return (
    <>
      <Text testID="auth-status">{auth.authStatus}</Text>
      <Text testID="auth-user-email">{auth.currentUser?.email ?? ''}</Text>
      <Text testID="auth-error">{auth.authError?.message ?? ''}</Text>
      <Text testID="auth-signed-in">{auth.isSignedIn ? 'yes' : 'no'}</Text>
      <Text
        testID="auth-request-otp"
        onPress={() => {
          void auth.requestEmailOtp('mobile-user@hominem.test').catch(() => undefined);
        }}
      >
        request otp
      </Text>
      <Text
        testID="auth-verify-otp"
        onPress={() => {
          void auth
            .verifyEmailOtp({
              email: 'mobile-user@hominem.test',
              otp: '123456',
            })
            .catch(() => undefined);
        }}
      >
        verify otp
      </Text>
      <Text
        testID="auth-complete-passkey"
        onPress={() => {
          void auth
            .completePasskeySignIn({
              user: {
                id: 'passkey-user-1',
                email: 'passkey-user@hominem.test',
                name: 'Passkey User',
              },
            })
            .catch(() => undefined);
        }}
      >
        complete passkey
      </Text>
      <Text
        testID="auth-sign-out"
        onPress={() => {
          void auth.signOut().catch(() => undefined);
        }}
      >
        sign out
      </Text>
    </>
  );
}

function renderProvider() {
  return renderScreen(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
}

describe('AuthProvider integration', () => {
  beforeEach(() => {
    mockGetItemAsync.mockReset();
    mockSetItemAsync.mockReset();
    mockDeleteItemAsync.mockReset();
    mockUpsertUserProfile.mockReset();
    mockClearAllData.mockReset();
    mockGetUserProfile.mockReset();
    mockCapture.mockReset();
    mockCaptureException.mockReset();

    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hominem_mobile_local_migration_v1') return '1';
      if (key === 'hominem_mobile_session_cookie_v1') return null;
      if (key === 'hominem_cookie') return null;
      return null;
    });

    mockUpsertUserProfile.mockImplementation(
      async (profile: { email: string; id: string; name: string }) => ({
        ...profile,
        image: null,
        emailVerified: false,
        createdAt: new Date('2029-01-01T00:00:00.000Z'),
        updatedAt: new Date('2029-01-01T00:00:00.000Z'),
      }),
    );
    mockClearAllData.mockResolvedValue(true);
    mockGetUserProfile.mockResolvedValue(null);
  });

  it('boots into signed_in when a persisted cookie resolves to a valid session', async () => {
    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hominem_mobile_local_migration_v1') return '1';
      if (key === 'hominem_mobile_session_cookie_v1') {
        return 'better-auth.session_token=session-token';
      }
      return null;
    });
    mswServer.use(mockAuthBootSignedIn());

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
    });
    expect(screen.getByTestId('auth-user-email')).toHaveTextContent('mobile-user@hominem.test');
    expect(screen.getByTestId('auth-signed-in')).toHaveTextContent('yes');
    expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1);
  });

  it('boots into signed_out when there is no persisted cookie', async () => {
    mswServer.use(mockAuthBootSignedOut());

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });
    expect(screen.getByTestId('auth-signed-in')).toHaveTextContent('no');
  });

  it('requests an email OTP through the real provider action', async () => {
    mswServer.use(mockAuthBootSignedOut(), mockSendVerificationOtpSuccess());

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });

    await press(screen.getByTestId('auth-request-otp'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('otp_requested');
    });
    expect(mockCapture).toHaveBeenCalledWith(
      'auth_email_otp_request_succeeded',
      expect.objectContaining({ phase: 'email_otp_request' }),
    );
  });

  it('surfaces OTP request failures through provider state', async () => {
    mswServer.use(mockAuthBootSignedOut(), mockSendVerificationOtpError('Rate limit hit'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });

    await press(screen.getByTestId('auth-request-otp'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('degraded');
    });
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Rate limit hit');
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

  it('verifies email OTP and persists the user profile', async () => {
    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hominem_mobile_local_migration_v1') return '1';
      if (key === 'hominem_mobile_session_cookie_v1') {
        return 'better-auth.session_token=session-token';
      }
      return null;
    });
    mswServer.use(mockAuthBootSignedOut(), mockVerifyEmailOtpSuccess());

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });

    await press(screen.getByTestId('auth-verify-otp'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
    });
    expect(screen.getByTestId('auth-user-email')).toHaveTextContent('mobile-user@hominem.test');
    expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1);
    expect(mockCapture).toHaveBeenCalledWith(
      'auth_email_otp_verify_succeeded',
      expect.objectContaining({ phase: 'email_otp_verify' }),
    );
  });

  it('completes passkey sign-in and persists the returned user', async () => {
    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hominem_mobile_local_migration_v1') return '1';
      if (key === 'hominem_mobile_session_cookie_v1') {
        return 'better-auth.session_token=passkey-session-token';
      }
      return null;
    });
    mswServer.use(mockAuthBootSignedOut());

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });

    await press(screen.getByTestId('auth-complete-passkey'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
    });
    expect(screen.getByTestId('auth-user-email')).toHaveTextContent('passkey-user@hominem.test');
    expect(mockUpsertUserProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'passkey-user-1',
        email: 'passkey-user@hominem.test',
      }),
    );
  });

  it('signs out through the provider action and clears local session state', async () => {
    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hominem_mobile_local_migration_v1') return '1';
      if (key === 'hominem_mobile_session_cookie_v1') {
        return 'better-auth.session_token=session-token';
      }
      return null;
    });
    mswServer.use(mockAuthBootSignedIn(), mockSignOutSuccess());

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
    });

    await press(screen.getByTestId('auth-sign-out'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });
    expect(screen.getByTestId('auth-signed-in')).toHaveTextContent('no');
    expect(mockClearAllData).toHaveBeenCalledTimes(1);
    expect(mockDeleteItemAsync).toHaveBeenCalledWith('hominem_mobile_session_cookie_v1');
    expect(mockCapture).toHaveBeenCalledWith(
      'auth_sign_out_succeeded',
      expect.objectContaining({ phase: 'sign_out' }),
    );
  });

  it('enters terminal_error when sign out fails', async () => {
    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === 'hominem_mobile_local_migration_v1') return '1';
      if (key === 'hominem_mobile_session_cookie_v1') {
        return 'better-auth.session_token=session-token';
      }
      return null;
    });
    mswServer.use(mockAuthBootSignedIn(), mockSignOutError('Remote sign-out failed'));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_in');
    });

    await press(screen.getByTestId('auth-sign-out'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('terminal_error');
    });
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Remote sign-out failed');
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockClearAllData).not.toHaveBeenCalled();
    expect(mockDeleteItemAsync).not.toHaveBeenCalled();
  });

  it('returns to otp_requested on OTP verification failure', async () => {
    mswServer.use(
      mockAuthBootSignedOut(),
      mockSendVerificationOtpSuccess(),
      mockVerifyEmailOtpError('Invalid or expired code.'),
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('signed_out');
    });

    await press(screen.getByTestId('auth-request-otp'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('otp_requested');
    });

    await press(screen.getByTestId('auth-verify-otp'));

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('otp_requested');
    });
    expect(screen.getByTestId('auth-error')).toHaveTextContent('Invalid or expired code.');
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });

});
