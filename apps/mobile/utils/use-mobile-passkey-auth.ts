import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import { authClient } from '~/lib/auth-client';
import { API_BASE_URL, E2E_AUTH_SECRET, E2E_TESTING } from '~/utils/constants';

interface PasskeySignInResult {
  user: {
    id: string;
    email: string;
    name?: string;
  };
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

export function useMobilePasskeyAuth(): UseMobilePasskeyAuthReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const passkeysResult = authClient.useListPasskeys();

  // Passkeys require iOS 16+. Earlier versions and non-iOS platforms are not supported.
  const isSupported =
    Platform.OS === 'ios' && Number.parseInt(Platform.Version as string, 10) >= 16;

  const signIn = useCallback(
    async (
      mode: 'real' | 'e2e-success' | 'e2e-cancel' = 'real',
    ): Promise<PasskeySignInResult | null> => {
      setIsLoading(true);
      setError(null);

      try {
        if (E2E_TESTING && mode !== 'real') {
          if (mode === 'e2e-cancel') {
            const message = 'Passkey sign-in was cancelled';
            setError(message);
            return null;
          }

          const email = `mobile-passkey-${Date.now()}@hominem.test`;
          const response = await fetch(
            new URL('/api/auth/mobile/e2e/login', API_BASE_URL).toString(),
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-e2e-auth-secret': E2E_AUTH_SECRET,
              },
              body: JSON.stringify({
                email,
                name: 'Mobile Passkey E2E User',
                amr: ['passkey', 'e2e', 'mobile'],
              }),
            },
          );

          if (!response.ok) {
            const body = (await response.json()) as { error?: string };
            setError(body.error || 'Failed to complete E2E passkey sign-in');
            return null;
          }

          const payload = (await response.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            token_type: 'Bearer';
            user?: {
              id: string;
              email: string;
              name?: string;
            };
          };

          return {
            user: payload.user ?? {
              id: `mobile-passkey-${Date.now()}`,
              email,
              name: 'Mobile Passkey E2E User',
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

  const addPasskey = useCallback(async (name?: string) => {
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

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add passkey';
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deletePasskey = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = (await authClient.$fetch('/passkey/delete-passkey', {
          method: 'POST',
          body: { id },
          throw: false,
        })) as {
          data: unknown;
          error: { message?: string } | null;
        };

        if (response.error) {
          const message = response.error.message ?? 'Failed to delete passkey';
          setError(message);
          return { success: false, error: message };
        }

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to delete passkey';
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    signIn,
    addPasskey,
    passkeys: (passkeysResult.data ?? []).map((passkey) => ({
      id: passkey.id,
      name: passkey.name ?? 'Unnamed passkey',
    })),
    deletePasskey,
    isLoading: isLoading || passkeysResult.isPending || passkeysResult.isRefetching,
    error,
    isSupported,
  };
}
