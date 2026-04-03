import type { Session, User } from '../types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

type AuthEventName = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

type SessionPayload = {
  user: User;
  session: Session;
} | null;

type BrowserAuthClient = {
  signOut: () => Promise<unknown>;
  $fetch: (
    path: '/get-session',
    init: { method: 'GET'; throw: false },
  ) => Promise<{ data: SessionPayload; error: { message?: string } | null }>;
};

export interface AuthConfig {
  apiBaseUrl: string;
}

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  signOut: () => Promise<void>;
  apiBaseUrl: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps extends PropsWithChildren {
  config: AuthConfig;
  initialUser?: User | null;
  initialSession?: Session | null;
  onAuthEvent?: (event: AuthEventName) => void;
}

function getAuthActionError(result: unknown) {
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

export function AuthProvider({ children, config, initialUser = null, initialSession = null, onAuthEvent }: AuthProviderProps) {
  const bootstrapSession = initialUser && initialSession ? { user: initialUser, session: initialSession } : null;
  const [resolvedSession, setResolvedSession] = useState<SessionPayload>(bootstrapSession);
  const [isLoading, setIsLoading] = useState(false);
  const user = resolvedSession?.user ?? null;
  const session = resolvedSession?.session ?? null;
  const userId = user?.id ?? null;
  const sessionSnapshot = `${userId ?? ''}:${session?.id ?? ''}:${String(session?.expiresAt ?? '')}`;
  const previousSnapshotRef = useRef(sessionSnapshot);
  const previousUserIdRef = useRef(userId);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    setIsLoading(true);

    try {
      const { getAuthClient } = await import('./auth-client');
      const authClient = getAuthClient(config.apiBaseUrl) as BrowserAuthClient;
      const result = await authClient.$fetch('/get-session', {
        method: 'GET',
        throw: false,
      });

      if (result.error) {
        setResolvedSession(null);
        return;
      }

      setResolvedSession(result.data ?? null);
    } finally {
      setIsLoading(false);
    }
  }, [config.apiBaseUrl]);

  const signOut = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

    const { getAuthClient } = await import('./auth-client');
    const authClient = getAuthClient(config.apiBaseUrl) as BrowserAuthClient;
    const result = await authClient.signOut();
    const error = getAuthActionError(result);
    if (error) {
      throw new Error(error);
    }

    setResolvedSession(null);
  }, [config.apiBaseUrl]);

  const logout = signOut;

  useEffect(() => {
    setResolvedSession(bootstrapSession);
  }, [bootstrapSession]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!onAuthEvent || isLoading) {
      previousSnapshotRef.current = sessionSnapshot;
      previousUserIdRef.current = userId;
      return;
    }

    const previousSnapshot = previousSnapshotRef.current;
    const previousUserId = previousUserIdRef.current;

    if (previousUserId !== userId) {
      onAuthEvent(userId ? 'SIGNED_IN' : 'SIGNED_OUT');
    } else if (userId && previousSnapshot !== sessionSnapshot) {
      onAuthEvent('TOKEN_REFRESHED');
    }

    previousSnapshotRef.current = sessionSnapshot;
    previousUserIdRef.current = userId;
  }, [isLoading, onAuthEvent, sessionSnapshot, userId]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      userId,
      isLoading,
      isAuthenticated: Boolean(userId),
      refresh,
      logout,
      signOut,
      apiBaseUrl: config.apiBaseUrl,
    }),
    [config.apiBaseUrl, isLoading, logout, refresh, session, signOut, user, userId],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useSafeAuth() {
  return useContext(AuthContext);
}

export function useAuth() {
  const context = useSafeAuth();
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
