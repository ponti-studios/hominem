import { useCallback, useMemo, useState } from 'react';

import { getAuthClient } from './auth-client';
import { useAuth } from './provider';

interface Passkey {
  id: string;
  name?: string;
  createdAt?: string | Date;
}

function getPasskeyActionError(result: { error?: { message?: string } | null }) {
  return result.error?.message ?? null;
}

export function usePasskeyAuth(input?: { redirectTo?: string }) {
  const { apiBaseUrl } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const isSupported = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
  const authClient = useMemo(() => getAuthClient(apiBaseUrl), [apiBaseUrl]);

  const authenticate = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setError(null);
    const result = await authClient.signIn.passkey();
    const actionError = getPasskeyActionError(result);
    if (actionError) {
      setError(actionError);
      throw new Error(actionError);
    }
    if (input?.redirectTo) {
      window.location.assign(input.redirectTo);
    }
  }, [authClient, input?.redirectTo, isSupported]);

  const register = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setError(null);
    const result = await authClient.passkey.addPasskey();
    const actionError = getPasskeyActionError(result);
    if (actionError) {
      setError(actionError);
      throw new Error(actionError);
    }
  }, [authClient, isSupported]);

  const deletePasskey = useCallback(async (id: string) => {
    setError(null);
    const response = await authClient.$fetch('/passkey/delete-passkey', {
      method: 'POST',
      body: { id },
      throw: false,
    });
    if (response.error) {
      const message = response.error.message ?? 'Passkey deletion failed.';
      setError(message);
      throw new Error(message);
    }
    authClient.$store.notify('$listPasskeys');
  }, [authClient]);

  return useMemo(
    () => ({ authenticate, register, deletePasskey, error, isSupported }),
    [authenticate, deletePasskey, error, isSupported, register],
  );
}

export function usePasskeys() {
  const { apiBaseUrl } = useAuth();
  const authClient = useMemo(() => getAuthClient(apiBaseUrl), [apiBaseUrl]);
  const query = authClient.useListPasskeys();
  const data = useMemo<Passkey[]>(
    () =>
      ((query.data ?? []) as Array<{ id: string; name?: string | null; createdAt?: string | Date }>).map(
        (passkey) => ({
          id: passkey.id,
          ...(passkey.name ? { name: passkey.name } : {}),
          ...(passkey.createdAt ? { createdAt: passkey.createdAt } : {}),
        }),
      ),
    [query.data],
  );

  return useMemo(
    () => ({
      data,
      isLoading: query.isPending,
      error: query.error,
      refetch: query.refetch,
    }),
    [data, query.error, query.isPending, query.refetch],
  );
}
