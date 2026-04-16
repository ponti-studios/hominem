import { useCallback, useMemo, useState } from 'react';

import { useAuthClient } from './provider';

type SessionHookResult = ReturnType<ReturnType<typeof useAuthClient>['useSession']>;

type Passkey = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
};

type AuthResult<TData = unknown> = {
  data?: TData | null;
  error?: {
    message?: string;
  } | null;
};

type PasskeyBrowser = {
  PublicKeyCredential?: typeof PublicKeyCredential;
  navigator?: {
    webdriver?: boolean;
  };
};

export function hasPasskeySupport(browser: PasskeyBrowser | undefined) {
  return Boolean(browser?.PublicKeyCredential) && browser?.navigator?.webdriver !== true;
}

interface UsePasskeysResult {
  data: Passkey[];
  isLoading: boolean;
  error: SessionHookResult['error'] | null | undefined;
  refetch: () => void;
  isSupported: boolean;
  authenticate: () => Promise<void>;
  register: () => Promise<void>;
  deletePasskey: (id: string) => Promise<void>;
  authError: string | null;
}

export function usePasskeys(): UsePasskeysResult {
  const authClient = useAuthClient();
  const [authError, setAuthError] = useState<string | null>(null);
  const result = authClient.useListPasskeys();
  const isSupported = hasPasskeySupport(typeof window === 'undefined' ? undefined : window);

  const data = useMemo<Passkey[]>(() => {
    return (result.data ?? []).map((passkey) => ({
      id: passkey.id,
      ...(passkey.name ? { name: passkey.name } : {}),
      ...(passkey.createdAt ? { createdAt: passkey.createdAt } : {}),
    }));
  }, [result.data]);

  const authenticate = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setAuthError(null);
    const result = await authClient.signIn.passkey();
    if (result.error) {
      const error = result.error.message ?? 'Passkey sign-in failed.';
      setAuthError(error);
      throw new Error(error);
    }
  }, [authClient, isSupported]);

  const register = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setAuthError(null);
    const result = await authClient.passkey.addPasskey();
    if (result.error) {
      const error = result.error.message ?? 'Failed to register passkey.';
      setAuthError(error);
      throw new Error(error);
    }
  }, [authClient, isSupported]);

  const deletePasskey = useCallback(
    async (id: string) => {
      setAuthError(null);
      const response = (await authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
        throw: false,
      })) as AuthResult;
      const error = response.error?.message ?? 'Passkey deletion failed.';
      if (response.error) {
        setAuthError(error);
        throw new Error(error);
      }
    },
    [authClient],
  );

  return useMemo(
    () => ({
      data,
      isLoading: result.isPending || result.isRefetching,
      error: result.error,
      refetch: result.refetch,
      isSupported,
      authenticate,
      register,
      deletePasskey,
      authError,
    }),
    [
      authenticate,
      authError,
      data,
      deletePasskey,
      isSupported,
      register,
      result.error,
      result.isPending,
      result.isRefetching,
      result.refetch,
    ],
  );
}
