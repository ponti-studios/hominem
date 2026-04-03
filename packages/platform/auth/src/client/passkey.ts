import { useCallback, useEffect, useMemo, useState } from 'react';

import { hasPasskeySupport } from './passkey-support';
import { useAuth } from './provider';

interface Passkey {
  id: string;
  name?: string;
  createdAt?: string | Date;
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
  const { apiBaseUrl } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const isSupported = hasPasskeySupport(typeof window === 'undefined' ? undefined : window);

  const authenticate = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setError(null);
    const { getAuthClient } = await import('./auth-client');
    const authClient = getAuthClient(apiBaseUrl);
    const result = await authClient.signIn.passkey();
    const actionError = getPasskeyActionError(result);
    if (actionError) {
      setError(actionError);
      throw new Error(actionError);
    }
    if (input?.redirectTo) {
      window.location.assign(input.redirectTo);
    }
  }, [apiBaseUrl, input?.redirectTo, isSupported]);

  const register = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setError(null);
    const { getAuthClient } = await import('./auth-client');
    const authClient = getAuthClient(apiBaseUrl);
    const result = await authClient.passkey.addPasskey();
    const actionError = getPasskeyActionError(result);
    if (actionError) {
      setError(actionError);
      throw new Error(actionError);
    }
    window.dispatchEvent(new Event('hominem:passkeys-changed'));
  }, [apiBaseUrl, isSupported]);

  const deletePasskey = useCallback(async (id: string) => {
    setError(null);
    const { getAuthClient } = await import('./auth-client');
    const authClient = getAuthClient(apiBaseUrl);
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
    window.dispatchEvent(new Event('hominem:passkeys-changed'));
  }, [apiBaseUrl]);

  return useMemo(
    () => ({ authenticate, register, deletePasskey, error, isSupported }),
    [authenticate, deletePasskey, error, isSupported, register],
  );
}

export function usePasskeys() {
  const { apiBaseUrl } = useAuth();
  const [data, setData] = useState<Passkey[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { getAuthClient } = await import('./auth-client');
      const authClient = getAuthClient(apiBaseUrl);
      const response = await authClient.$fetch('/passkey/list-user-passkeys', {
        method: 'GET',
        throw: false,
      });

      if (response.error) {
        throw new Error(response.error.message ?? 'Failed to load passkeys.');
      }

      const nextData = ((response.data ?? []) as Array<{
        id: string;
        name?: string | null;
        createdAt?: string | Date;
      }>).map((passkey) => ({
        id: passkey.id,
        ...(passkey.name ? { name: passkey.name } : {}),
        ...(passkey.createdAt ? { createdAt: passkey.createdAt } : {}),
      }));

      setData(nextData);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError : new Error('Failed to load passkeys.'),
      );
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handlePasskeysChanged = () => {
      void refetch();
    };

    window.addEventListener('hominem:passkeys-changed', handlePasskeysChanged);
    return () => {
      window.removeEventListener('hominem:passkeys-changed', handlePasskeysChanged);
    };
  }, [refetch]);

  return useMemo(() => ({ data, isLoading, error, refetch }), [data, error, isLoading, refetch]);
}
