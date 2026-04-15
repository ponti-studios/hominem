import { useCallback, useMemo, useState } from 'react';

import type { AuthError } from './auth-client';
import { useAuthClient } from './provider';

interface Passkey {
  id: string;
  name?: string;
  createdAt?: string | Date;
}

type PasskeyBrowser = {
  PublicKeyCredential?: typeof PublicKeyCredential;
  navigator?: {
    webdriver?: boolean;
  };
};

export function hasPasskeySupport(browser: PasskeyBrowser | undefined) {
  return Boolean(browser?.PublicKeyCredential) && browser?.navigator?.webdriver !== true;
}

function getFetchErrorMessage(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (!('error' in record)) {
    return null;
  }

  const error = record.error;
  if (!error || typeof error !== 'object') {
    return 'Passkey deletion failed.';
  }

  const errorRecord = error as Record<string, unknown>;
  if (!('message' in errorRecord)) {
    return 'Passkey deletion failed.';
  }

  const message = errorRecord.message;
  return typeof message === 'string' ? message : 'Passkey deletion failed.';
}

function getPasskeyActionError(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const record = result as Record<string, unknown>;
  if (!('error' in record)) {
    return null;
  }

  const error = record.error;
  if (!error || typeof error !== 'object') {
    return null;
  }

  const errorRecord = error as Record<string, unknown>;
  if (!('message' in errorRecord)) {
    return null;
  }

  const message = errorRecord.message;
  return typeof message === 'string' ? message : null;
}

export interface UsePasskeysResult {
  data: Passkey[];
  isLoading: boolean;
  error: AuthError | null | undefined;
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
    const actionError = getPasskeyActionError(result);
    if (actionError) {
      setAuthError(actionError);
      throw new Error(actionError);
    }
  }, [authClient, isSupported]);

  const register = useCallback(async () => {
    if (!isSupported) {
      throw new Error('Passkeys are not supported in this browser.');
    }
    setAuthError(null);
    const result = await authClient.passkey.addPasskey();
    const actionError = getPasskeyActionError(result);
    if (actionError) {
      setAuthError(actionError);
      throw new Error(actionError);
    }
  }, [authClient, isSupported]);

  const deletePasskey = useCallback(
    async (id: string) => {
      setAuthError(null);
      const response = await authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
        throw: false,
      });
      const message = getFetchErrorMessage(response);
      if (message) {
        setAuthError(message);
        throw new Error(message);
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
