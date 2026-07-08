import { passkeyClient } from '@better-auth/passkey/client';
import type { Session, User } from 'better-auth';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

export {
  useEmailAuth,
  type EmailAuthOperations,
  type UseEmailAuthOptions,
  type UseEmailAuthOutput,
} from './email-auth';

type AuthClientOptions = {
  baseURL: string;
  plugins: [ReturnType<typeof emailOTPClient>, ReturnType<typeof passkeyClient>];
};

type AuthClient = ReturnType<typeof createAuthClient<AuthClientOptions>>;
type SessionHookResult = ReturnType<AuthClient['useSession']>;

interface AuthConfig {
  apiBaseUrl: string;
}

type AuthProviderContextValue = {
  apiBaseUrl: string;
  authClient: AuthClient;
};

const AuthContext = createContext<AuthProviderContextValue | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  config: AuthConfig;
}

export function AuthProvider({ children, config }: AuthProviderProps) {
  const value = useMemo<AuthProviderContextValue>(() => {
    return {
      apiBaseUrl: config.apiBaseUrl,
      authClient: createAuthClient<AuthClientOptions>({
        baseURL: config.apiBaseUrl,
        plugins: [emailOTPClient(), passkeyClient()],
      }),
    };
  }, [config.apiBaseUrl]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthClient(): AuthClient {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthClient must be used within AuthProvider');
  }
  return context.authClient;
}

export function useSession(): SessionHookResult {
  return useAuthClient().useSession();
}

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  userId: string | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

/**
 * Compatibility hook for legacy useAuthContext API.
 * Returns { user, isLoading, session, userId, authClient }.
 */
export function useAuthContext(): AuthContextValue {
  const { data: session, isPending: isLoading } = useSession();
  const authClient = useAuthClient();

  return {
    user: (session?.user ?? null) as User | null,
    session: (session?.session ?? null) as Session | null,
    userId: session?.user?.id ?? null,
    isLoading,
    logout: async () => {
      await authClient.signOut();
    },
  };
}

/**
 * Compatibility hook — returns auth context or null if not inside AuthProvider.
 * Use this in optional auth contexts.
 */
export function useSafeAuth(): AuthContextValue | null {
  try {
    return useAuthContext();
  } catch {
    return null;
  }
}
