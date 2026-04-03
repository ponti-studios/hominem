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
  isAuthenticated: boolean;
  user: User | null;
  session?: Session | null;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  apiBaseUrl: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps extends PropsWithChildren {
  config: {
    apiBaseUrl: string;
  };
  initialUser?: User | null;
  initialSession?: Session | null;
  onAuthEvent?: (event: AuthEventName) => void;
}

async function fetchSession(apiBaseUrl: string): Promise<SessionPayload> {
  const response = await fetch(new URL('/api/auth/session', apiBaseUrl).toString(), {
    method: 'GET',
    credentials: 'include',
  });

  if (!response.ok) {
    return { isAuthenticated: false, user: null, session: null };
  }

  return (await response.json()) as SessionPayload;
}

export function AuthProvider({ children, config, initialUser = null, initialSession = null, onAuthEvent }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [isLoading, setIsLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await fetchSession(config.apiBaseUrl);
      if (!mountedRef.current) return;
      setUser(next.user ?? null);
      setSession(next.session ?? null);
      onAuthEvent?.(next.user ? 'TOKEN_REFRESHED' : 'SIGNED_OUT');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [config.apiBaseUrl, onAuthEvent]);

  const logout = useCallback(async () => {
    await fetch(new URL('/api/auth/logout', config.apiBaseUrl).toString(), {
      method: 'POST',
      credentials: 'include',
    });
    if (!mountedRef.current) return;
    setUser(null);
    setSession(null);
    onAuthEvent?.('SIGNED_OUT');
  }, [config.apiBaseUrl, onAuthEvent]);

  useEffect(() => {
    if (initialUser || initialSession) {
      return;
    }
    void refresh();
  }, [initialSession, initialUser, refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      userId: user?.id ?? null,
      isLoading,
      isAuthenticated: Boolean(user?.id),
      refresh,
      logout,
      apiBaseUrl: config.apiBaseUrl,
    }),
    [config.apiBaseUrl, isLoading, logout, refresh, session, user],
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
