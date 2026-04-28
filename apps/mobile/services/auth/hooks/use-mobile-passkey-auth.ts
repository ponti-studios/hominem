import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { E2E_TESTING } from '~/constants';
import { authClient } from '~/services/auth/auth-client';

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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<{ id: string; name: string }[]>([]);
  const [passkeysLoading, setPasskeysLoading] = useState(Boolean(options.loadPasskeys));
  const [passkeysError, setPasskeysError] = useState<string | null>(null);

  // Passkeys require iOS 16+. Earlier versions and non-iOS platforms are not supported.
  const isSupported =
    Platform.OS === 'ios' && Number.parseInt(Platform.Version as string, 10) >= 16;

  const loadPasskeys = useCallback(async () => {
    if (!options.loadPasskeys) {
      return;
    }

    setPasskeysLoading(true);
    setPasskeysError(null);

    try {
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

      setPasskeys(
        (response.data ?? []).map((passkey) => ({
          id: passkey.id,
          name: passkey.name ?? 'Unnamed passkey',
        })),
      );
    } catch (err) {
      setPasskeys([]);
      setPasskeysError(err instanceof Error ? err.message : 'Failed to load passkeys');
    } finally {
      setPasskeysLoading(false);
    }
  }, [options.loadPasskeys]);

  useEffect(() => {
    void loadPasskeys();
  }, [loadPasskeys]);

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

        const { data: passkeyData, error: passkeyError } = await authClient.signIn.passkey();

        if (passkeyError) {
          const message = toErrorMessage(passkeyError, 'Passkey sign-in failed');
          setError(message);
          return null;
        }

        if (!passkeyData?.user?.id || !passkeyData.user.email) {
          setError('No data returned from passkey sign-in');
          return null;
        }

        return {
          user: {
            id: passkeyData.user.id,
            email: passkeyData.user.email,
            ...(passkeyData.user.name ? { name: passkeyData.user.name } : {}),
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
        const { error: passkeyError } = await authClient.passkey.addPasskey({
          name,
        });

        if (passkeyError) {
          const message = toErrorMessage(passkeyError, 'Failed to add passkey');
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
        const response = await authClient.deletePasskey({ id });

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
    const displayError = error ?? passkeysError;

    return {
      signIn,
      addPasskey,
      passkeys,
      deletePasskey,
      isLoading: isLoading || passkeysLoading,
      error: displayError,
      isSupported,
    };
  }, [
    addPasskey,
    deletePasskey,
    error,
    isLoading,
    isSupported,
    passkeys,
    passkeysError,
    passkeysLoading,
    signIn,
  ]);
}
