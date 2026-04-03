import type { Session, User } from '../types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';

import { getAuthClient } from './auth-client';

type AuthEventName = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

type SessionPayload = {
  user: User;
  session: Session;
} | null;

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

function getAuthActionError(result: { error?: { message?: string } | null }) {
  return result.error?.message ?? null;
}

export function AuthProvider({ children, config, initialUser = null, initialSession = null, onAuthEvent }: AuthProviderProps) {
  const authClient = useMemo(() => getAuthClient(config.apiBaseUrl), [config.apiBaseUrl]);
  const sessionQuery = authClient.useSession();
  const bootstrapSession = initialUser && initialSession ? { user: initialUser, session: initialSession } : null;
  const resolvedSession = (sessionQuery.data as SessionPayload | undefined) ?? bootstrapSession;
  const user = resolvedSession?.user ?? null;
  const session = resolvedSession?.session ?? null;
  const userId = user?.id ?? null;
  const isLoading = sessionQuery.isPending && !bootstrapSession;
  const sessionSnapshot = `${userId ?? ''}:${session?.id ?? ''}:${String(session?.expiresAt ?? '')}`;
  const previousSnapshotRef = useRef(sessionSnapshot);
  const previousUserIdRef = useRef(userId);

  const refresh = useCallback(async () => {
    await sessionQuery.refetch();
  }, [sessionQuery]);

  const signOut = useCallback(async () => {
    const result = await authClient.signOut();
    const error = getAuthActionError(result);
    if (error) {
      throw new Error(error);
    }
  }, [authClient]);

  const logout = signOut;

  useEffect(() => {
    if (!onAuthEvent || sessionQuery.isPending) {
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
  }, [onAuthEvent, sessionQuery.isPending, sessionSnapshot, userId]);

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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
