import { useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AuthContext } from './AuthContext';
import type { AppAuthStatus, AuthConfig, AuthContextType, User } from './types';
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT';

interface SessionResponse {
  isAuthenticated: boolean;
  user: User | null;
  auth?: {
    sub: string;
    sid: string;
    amr: string[];
    authTime: number;
  } | null;
}

function getAbsoluteApiUrl(apiBaseUrl: string, path: string) {
  return new URL(path, apiBaseUrl).toString();
}

interface ClientAuthState {
  error: Error | null;
  isLoading: boolean;
  status: AppAuthStatus;
  user: User | null;
}

async function fetchSession(apiBaseUrl: string): Promise<SessionResponse> {
  const res = await fetch(getAbsoluteApiUrl(apiBaseUrl, '/api/auth/session'), {
    method: 'GET',
    credentials: 'include',
  });

  if (res.ok) {
    return (await res.json()) as SessionResponse;
  }

  return { isAuthenticated: false, user: null };
}

export type AuthProviderProps = {
  children: ReactNode;
  config: AuthConfig;
  onAuthEvent?: (event: AuthEvent) => void;
  initialUser?: User | null;
};

export function AuthProvider({
  children,
  config,
  onAuthEvent,
  initialUser = null,
}: AuthProviderProps) {
  const hasInitialAuth = Boolean(initialUser);
  const [authState, setAuthState] = useState<ClientAuthState>(() => ({
    error: null,
    isLoading: !hasInitialAuth,
    status: hasInitialAuth ? 'signed_in' : 'booting',
    user: initialUser,
  }));

  const refreshAuth = useCallback(async () => {
    const payload = await fetchSession(config.apiBaseUrl);
    setAuthState((currentState) => {
      const user = payload.user ?? null;

      return {
        error: null,
        isLoading: false,
        status: user ? 'signed_in' : 'signed_out',
        user,
      };
    });
    return payload;
  }, [config.apiBaseUrl]);

  useEffect(() => {
    if (hasInitialAuth) {
      return;
    }
    void refreshAuth();
  }, [hasInitialAuth, refreshAuth]);

  const signIn = useCallback(async () => {
    // Default sign-in: redirect to email sign-in page
    window.location.href = '/auth';
  }, []);

  const signOut = useCallback(async () => {
    setAuthState((currentState) => ({
      ...currentState,
      error: null,
      isLoading: true,
      status: 'signing_out',
    }));
    try {
      const response = await fetch(getAbsoluteApiUrl(config.apiBaseUrl, '/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to sign out. Please try again.');
      }

      setAuthState({
        error: null,
        isLoading: false,
        status: 'signed_out',
        user: null,
      });
      onAuthEvent?.('SIGNED_OUT');
    } catch (error) {
      const resolvedError =
        error instanceof Error ? error : new Error('Failed to sign out. Please try again.');
      setAuthState((currentState) => ({
        ...currentState,
        error: resolvedError,
        isLoading: false,
        status: currentState.user ? 'signed_in' : 'signed_out',
      }));
      throw resolvedError;
    }
  }, [config.apiBaseUrl, onAuthEvent]);

  const value = useMemo<AuthContextType>(
    () => ({
      user: authState.user,
      isLoading: authState.isLoading,
      isAuthenticated: authState.status === 'signed_in',
      signIn,
      signOut,
      userId: authState.user?.id,
    }),
    [authState, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Safe access to auth context which may be null during SSR or outside the
 * provider. Use this in layout components or other places where context may not be available.
 */
export function useSafeAuth(): AuthContextType | null {
  return useContext(AuthContext) ?? null;
}

/**
 * Strict hook that throws if no provider is found.
 */
export function useAuthContext(): AuthContextType {
  const context = useSafeAuth();
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
