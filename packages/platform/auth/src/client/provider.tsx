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

type SessionQueryResult = {
  data?: SessionPayload;
  isPending: boolean;
  refetch: () => Promise<unknown>;
};

type BrowserAuthClient = {
  useSession: () => SessionQueryResult;
  signOut: () => Promise<unknown>;
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

function AuthSessionObserver({
  authClient,
  bootstrapSession,
  onChange,
}: {
  authClient: BrowserAuthClient;
  bootstrapSession: SessionPayload;
  onChange: (input: {
    resolvedSession: SessionPayload | undefined;
    isPending: boolean;
    refetch: () => Promise<unknown>;
  }) => void;
}) {
  const sessionQuery = authClient.useSession();

  useEffect(() => {
    onChange({
      resolvedSession: (sessionQuery.data as SessionPayload | undefined) ?? bootstrapSession,
      isPending: sessionQuery.isPending,
      refetch: sessionQuery.refetch,
    });
  }, [bootstrapSession, onChange, sessionQuery.data, sessionQuery.isPending, sessionQuery.refetch]);

  return null;
}

export function AuthProvider({ children, config, initialUser = null, initialSession = null, onAuthEvent }: AuthProviderProps) {
  const bootstrapSession = initialUser && initialSession ? { user: initialUser, session: initialSession } : null;
  const [authClient, setAuthClient] = useState<BrowserAuthClient | null>(null);
  const [resolvedClientSession, setResolvedClientSession] = useState<SessionPayload | undefined>(bootstrapSession);
  const [isClientSessionPending, setIsClientSessionPending] = useState(false);
  const refetchRef = useRef<(() => Promise<unknown>) | null>(null);

  useEffect(() => {
    setAuthClient(null);
    setResolvedClientSession(bootstrapSession);
    setIsClientSessionPending(false);
    refetchRef.current = null;

    if (typeof window === 'undefined') {
      return;
    }

    let isActive = true;

    void import('./auth-client')
      .then(({ getAuthClient }) => {
        if (isActive) {
          setAuthClient(getAuthClient(config.apiBaseUrl) as BrowserAuthClient);
        }
      })
      .catch(() => {
        if (isActive) {
          setAuthClient(null);
        }
      });

    return () => {
      isActive = false;
    };
  }, [bootstrapSession, config.apiBaseUrl]);

  const resolvedSession = resolvedClientSession ?? bootstrapSession;
  const user = resolvedSession?.user ?? null;
  const session = resolvedSession?.session ?? null;
  const userId = user?.id ?? null;
  const isLoading = isClientSessionPending && !bootstrapSession;
  const sessionSnapshot = `${userId ?? ''}:${session?.id ?? ''}:${String(session?.expiresAt ?? '')}`;
  const previousSnapshotRef = useRef(sessionSnapshot);
  const previousUserIdRef = useRef(userId);

  const refresh = useCallback(async () => {
    if (refetchRef.current) {
      await refetchRef.current();
    }
  }, []);

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
  }, [config.apiBaseUrl]);

  const logout = signOut;

  useEffect(() => {
    if (!onAuthEvent || isClientSessionPending) {
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
  }, [isClientSessionPending, onAuthEvent, sessionSnapshot, userId]);

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
      {authClient ? (
        <AuthSessionObserver
          authClient={authClient}
          bootstrapSession={bootstrapSession}
          onChange={({ resolvedSession, isPending, refetch }) => {
            refetchRef.current = refetch;
            setResolvedClientSession(resolvedSession);
            setIsClientSessionPending(isPending);
          }}
        />
      ) : null}
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
