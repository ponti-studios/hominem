import { useCallback, useMemo, useState } from 'react';

import { hasPasskeySupport } from './passkey-support';
import { useAuthClient } from './provider';

interface Passkey {
  id: string;
  name?: string;
  createdAt?: string | Date;
}

function getFetchErrorMessage(result: unknown) {
  if (!result || typeof result !== 'object' || !('error' in result)) {
    return null;
  }

  const error = (result as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return 'Passkey deletion failed.';
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : 'Passkey deletion failed.';
}

function getPasskeyActionError(result: unknown) {
  if (!result || typeof result !== 'object' || !('error' in result)) {
    return null;
  }

  const error = (result as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || !('message' in error)) {
    return null;
  }

  const message = (error as { message?: unknown }).message;
  return typeof message === 'string' ? message : null;
}

export function usePasskeyAuth(input?: { redirectTo?: string }) {
  const authClient = useAuthClient();
  const [error, setError] = useState<string | null>(null);
  const isSupported = hasPasskeySupport(typeof window === 'undefined' ? undefined : window);

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

  const deletePasskey = useCallback(
    async (id: string) => {
      setError(null);
      const response = await authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
        throw: false,
      });
      const message = getFetchErrorMessage(response);
      if (message) {
        setError(message);
        throw new Error(message);
      }
    },
    [authClient],
  );

  return useMemo(
    () => ({ authenticate, register, deletePasskey, error, isSupported }),
    [authenticate, deletePasskey, error, isSupported, register],
  );
}

export function usePasskeys() {
  const authClient = useAuthClient();
  const result = authClient.useListPasskeys();
  const data = useMemo<Passkey[]>(() => {
    return (result.data ?? []).map((passkey) => ({
      id: passkey.id,
      ...(passkey.name ? { name: passkey.name } : {}),
      ...(passkey.createdAt ? { createdAt: passkey.createdAt } : {}),
    }));
  }, [result.data]);

  return useMemo(
    () => ({
      data,
      isLoading: result.isPending || result.isRefetching,
      error: result.error,
      refetch: result.refetch,
    }),
    [data, result.error, result.isPending, result.isRefetching, result.refetch],
  );
}
