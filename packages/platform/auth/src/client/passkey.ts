import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuthClient } from './provider';

type SessionHookResult = ReturnType<ReturnType<typeof useAuthClient>['useSession']>;

type Passkey = {
  id: string;
  name?: string | null;
  createdAt?: string | Date | null;
};

function getPasskeySupport(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(window.PublicKeyCredential && window.navigator?.webdriver !== true);
}

type AuthResult<TData = unknown> = {
  data?: TData | null;
  error?: {
    message?: string;
  } | null;
};

interface UsePasskeysResult {
  data: Passkey[];
  isLoading: boolean;
  error: SessionHookResult['error'] | null | undefined;
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
  const [passkeysError, setPasskeysError] = useState<SessionHookResult['error'] | null | undefined>(
    null,
  );
  const [isPasskeysLoading, setIsPasskeysLoading] = useState(Boolean(options.enabled));
  const [isSupported, setIsSupported] = useState(false);
  const shouldLoadPasskeys = options.enabled ?? false;

  useEffect(() => {
    setIsSupported(getPasskeySupport());
  }, []);

  const fetchPasskeys = useCallback(
    async (force = false) => {
      if (!shouldLoadPasskeys && !force) {
        return;
      }

      setIsPasskeysLoading(true);
      setPasskeysError(null);

      try {
        const response = (await authClient.$fetch('/passkey/list-user-passkeys', {
          method: 'GET',
          throw: false,
        })) as AuthResult<Passkey[]>;

        if (response.error) {
          setPasskeysError(response.error as unknown as SessionHookResult['error']);
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
      } catch (error) {
        setPasskeysError(error as unknown as SessionHookResult['error']);
        if (!options.initialPasskeys?.length) {
          setData([]);
        }
      } finally {
        setIsPasskeysLoading(false);
      }
    },
    [authClient, options.initialPasskeys, shouldLoadPasskeys],
  );

  useEffect(() => {
    if (!shouldLoadPasskeys) {
      return;
    }

    void fetchPasskeys(true);
  }, [fetchPasskeys, shouldLoadPasskeys]);

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
    await fetchPasskeys(true);
  }, [authClient, fetchPasskeys, isSupported]);

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
      await fetchPasskeys(true);
    },
    [authClient, fetchPasskeys],
  );

  return useMemo(
    () => ({
      data,
      isLoading: isPasskeysLoading,
      error: passkeysError,
      refetch: fetchPasskeys,
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
      fetchPasskeys,
      isPasskeysLoading,
      isSupported,
      passkeysError,
      register,
    ],
  );
}
