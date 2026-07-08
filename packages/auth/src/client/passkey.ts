import { useCallback, useEffect, useState } from 'react';

import { useAuthClient } from './provider';

export type Passkey = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
};

type ApiError = { message?: string } | null | undefined;

type ApiResult<TData = unknown> = {
  data?: TData | null;
  error?: ApiError;
};

function getPasskeySupport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  return Boolean(window.PublicKeyCredential && window.navigator?.webdriver !== true);
}

function requireSupport(isSupported: boolean): void {
  if (!isSupported) {
    throw new Error('Passkeys are not supported in this browser.');
  }
}

export interface UsePasskeysResult {
  data: Passkey[];
  isLoading: boolean;
  error: ApiError;
  refetch: () => Promise<void>;
  isSupported: boolean;
  authenticate: () => Promise<void>;
  register: () => Promise<void>;
  deletePasskey: (id: string) => Promise<void>;
  authError: string | null;
}

interface UsePasskeysOptions {
  enabled?: boolean;
  initialPasskeys?: Passkey[];
}

export function usePasskeys(options: UsePasskeysOptions = {}): UsePasskeysResult {
  const authClient = useAuthClient();
  const [authError, setAuthError] = useState<string | null>(null);
  const [data, setData] = useState<Passkey[]>(options.initialPasskeys ?? []);
  const [error, setError] = useState<ApiError>(null);
  const [isLoading, setIsLoading] = useState(Boolean(options.enabled));
  const [isSupported] = useState(getPasskeySupport);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = (await authClient.$fetch('/passkey/list-user-passkeys', {
        method: 'GET',
        throw: false,
      })) as ApiResult<Passkey[]>;

      if (response.error) {
        setError(response.error);
        if (!options.initialPasskeys?.length) {
          setData([]);
        }
        return;
      }

      setData(
        (response.data ?? []).map((passkey) => ({
          id: passkey.id,
          ...(passkey.name ? { name: passkey.name } : {}),
          ...(passkey.createdAt ? { createdAt: passkey.createdAt } : {}),
        })),
      );
    } catch (err) {
      setError(err as ApiError);
      if (!options.initialPasskeys?.length) {
        setData([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [authClient, options.initialPasskeys]);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }
    void refetch();
  }, [options.enabled, refetch]);

  const authenticate = useCallback(async () => {
    requireSupport(isSupported);
    setAuthError(null);
    const result = await authClient.signIn.passkey();
    if (result.error) {
      const message = result.error.message ?? 'Passkey sign-in failed.';
      setAuthError(message);
      throw new Error(message);
    }
  }, [authClient, isSupported]);

  const register = useCallback(async () => {
    requireSupport(isSupported);
    setAuthError(null);
    const result = await authClient.passkey.addPasskey();
    if (result.error) {
      const message =
        result.error.message?.includes('step_up') || result.error.message?.includes('403')
          ? 'Re-authenticate with a passkey, then try again.'
          : (result.error.message ?? 'Failed to register passkey.');
      setAuthError(message);
      throw new Error(message);
    }
    await refetch();
  }, [authClient, isSupported, refetch]);

  const deletePasskey = useCallback(
    async (id: string) => {
      setAuthError(null);
      const response = (await authClient.$fetch('/passkey/delete-passkey', {
        method: 'POST',
        body: { id },
        throw: false,
      })) as ApiResult & { error?: { message?: string; status?: number; code?: string } | null };
      if (response.error) {
        const raw = response.error.message ?? '';
        const message =
          raw.includes('step_up') || response.error.status === 403
            ? 'Re-authenticate with a passkey, then try again.'
            : raw || 'Passkey deletion failed.';
        setAuthError(message);
        throw new Error(message);
      }
      await refetch();
    },
    [authClient, refetch],
  );

  return {
    data,
    isLoading,
    error,
    refetch,
    isSupported,
    authenticate,
    register,
    deletePasskey,
    authError,
  };
}
