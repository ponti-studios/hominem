import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import {
  create as createPasskey,
  get as getPasskey,
  isSupported as isNativePasskeySupported,
} from 'react-native-passkeys';

import { E2E_TESTING } from '~/constants';
import { authClient, AuthResult } from '~/services/auth/auth-client';

type PasskeyRegistrationOptions = Parameters<typeof createPasskey>[0];
type PasskeyAuthenticationOptions = Parameters<typeof getPasskey>[0];

interface PasskeySignInResult {
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

interface UseMobilePasskeyAuthOptions {
  loadPasskeys?: boolean;
}

interface UseMobilePasskeyAuthReturn {
  signIn: (mode?: 'real' | 'e2e-success' | 'e2e-cancel') => Promise<PasskeySignInResult | null>;
  addPasskey: (name?: string) => Promise<{ success: boolean; error?: string }>;
  passkeys: { id: string; name: string }[];
  deletePasskey: (id: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
  isSupported: boolean;
}

function toErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return fallback;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : fallback;
}

export function useMobilePasskeyAuth(
  options: UseMobilePasskeyAuthOptions = {},
): UseMobilePasskeyAuthReturn {
  const loadPasskeysEnabled = Boolean(options.loadPasskeys);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isSupported = isNativePasskeySupported();

  const fetchPasskeys = useCallback(async () => {
    const response = (await authClient.$fetch('/passkey/list-user-passkeys', {
      method: 'GET',
      throw: false,
    })) as {
      data?: { id: string; name?: string | null }[] | null;
      error?: { message?: string } | null;
    };

    if (response.error) {
      throw new Error(response.error.message ?? 'Failed to load passkeys');
    }

    return (response.data ?? []).map((passkey) => ({
      id: passkey.id,
      name: passkey.name ?? 'Unnamed passkey',
    }));
  }, []);

  const passkeysQuery = useQuery({
    queryKey: ['mobile-passkeys'],
    queryFn: fetchPasskeys,
    enabled: loadPasskeysEnabled,
  });
  const loadPasskeys = useCallback(async () => {
    if (!loadPasskeysEnabled) {
      return;
    }

    await passkeysQuery.refetch();
  }, [loadPasskeysEnabled, passkeysQuery]);

  const signIn = useCallback(
    async (
      mode: 'real' | 'e2e-success' | 'e2e-cancel' = 'real',
    ): Promise<PasskeySignInResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        if (E2E_TESTING && mode !== 'real') {
          if (mode === 'e2e-cancel') {
            setError('Passkey sign-in was cancelled');
            return null;
          }

          // Use the real OTP flow with the server's fixed test OTP so the
          // BetterAuth Expo client stores a genuine session cookie.
          const email = 'mobile-passkey-e2e@hominem.test';
          const TEST_OTP = '000000';

          const sendResult = await authClient.emailOtp.sendVerificationOtp({
            email,
            type: 'sign-in',
          });
          if (sendResult.error) {
            setError(sendResult.error.message ?? 'Failed to send E2E OTP');
            return null;
          }

          const signInResult = await authClient.signIn.emailOtp({ email, otp: TEST_OTP });
          if (signInResult.error || !signInResult.data) {
            setError(signInResult.error?.message ?? 'E2E sign-in failed');
            return null;
          }

          const userData = (
            signInResult.data as { user?: { id: string; email: string; name?: string | null } }
          ).user;
          return {
            user: {
              id: userData?.id ?? '',
              email: userData?.email ?? email,
              name: userData?.name ?? undefined,
            },
          };
        }

        const optionsResponse = (await authClient.$fetch('/passkey/generate-authenticate-options', {
          method: 'GET',
          throw: false,
        })) as {
          data?: PasskeyAuthenticationOptions | null;
          error?: { message?: string } | null;
        };

        if (optionsResponse.error || !optionsResponse.data) {
          setError(optionsResponse.error?.message ?? 'Failed to start passkey sign-in');
          return null;
        }

        const assertion = await getPasskey(optionsResponse.data);
        if (!assertion) {
          setError('Passkey sign-in was cancelled');
          return null;
        }

        const { clientExtensionResults: _clientExtensionResults, ...responseBody } = assertion;

        const verifyResponse = (await authClient.$fetch('/passkey/verify-authentication', {
          method: 'POST',
          body: { response: responseBody },
          throw: false,
        })) as {
          data?: { user?: { id: string; email: string; name?: string | null } } | null;
          error?: { message?: string } | null;
        };

        if (verifyResponse.error) {
          setError(toErrorMessage(verifyResponse.error, 'Passkey sign-in failed'));
          return null;
        }

        const userData = verifyResponse.data?.user;
        if (!userData?.id || !userData.email) {
          setError('No data returned from passkey sign-in');
          return null;
        }

        return {
          user: {
            id: userData.id,
            email: userData.email,
            ...(userData.name ? { name: userData.name } : {}),
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Passkey sign-in failed';
        setError(message);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const addPasskey = useCallback(
    async (name?: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const optionsResponse = (await authClient.$fetch('/passkey/generate-register-options', {
          method: 'GET',
          query: name ? { name } : undefined,
          throw: false,
        })) as {
          data?: PasskeyRegistrationOptions | null;
          error?: { message?: string } | null;
        };

        if (optionsResponse.error || !optionsResponse.data) {
          const message = toErrorMessage(
            optionsResponse.error,
            'Failed to start passkey registration',
          );
          setError(message);
          return { success: false, error: message };
        }

        const credential = await createPasskey(optionsResponse.data);
        if (!credential) {
          const message = 'Passkey registration was cancelled';
          setError(message);
          return { success: false, error: message };
        }

        const { clientExtensionResults: _clientExtensionResults, ...responseBody } = credential;

        const verifyResponse = (await authClient.$fetch('/passkey/verify-registration', {
          method: 'POST',
          body: { response: responseBody, name },
          throw: false,
        })) as {
          data?: unknown;
          error?: { message?: string } | null;
        };

        if (verifyResponse.error) {
          const message = toErrorMessage(verifyResponse.error, 'Failed to add passkey');
          setError(message);
          return { success: false, error: message };
        }

        await loadPasskeys();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add passkey';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [loadPasskeys],
  );

  const deletePasskey = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await authClient.$fetch<AuthResult>('/passkey/delete-passkey', {
          method: 'POST',
          body: { id },
          throw: false,
        });

        if (response.error) {
          const message = response.error.message ?? 'Failed to delete passkey';
          setError(message);
          return { success: false, error: message };
        }

        await loadPasskeys();
        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete passkey';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [loadPasskeys],
  );

  return useMemo(() => {
    const displayError = error ?? passkeysQuery.error?.message ?? null;

    return {
      signIn,
      addPasskey,
      passkeys: passkeysQuery.data ?? [],
      deletePasskey,
      isLoading: isLoading || passkeysQuery.isFetching,
      error: displayError,
      isSupported,
    };
  }, [
    addPasskey,
    deletePasskey,
    error,
    isLoading,
    isSupported,
    passkeysQuery.data,
    passkeysQuery.error,
    passkeysQuery.isFetching,
    signIn,
  ]);
}
