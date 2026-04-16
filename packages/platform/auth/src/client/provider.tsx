import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

type AuthClientOptions = {
  baseURL: string;
  plugins: [ReturnType<typeof emailOTPClient>, ReturnType<typeof passkeyClient>];
};

type AuthClient = ReturnType<typeof createAuthClient<AuthClientOptions>>;
type SessionHookResult = ReturnType<AuthClient['useSession']>;

interface AuthConfig {
  apiBaseUrl: string;
}

type AuthContextValue = {
  apiBaseUrl: string;
  authClient: AuthClient;
};

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  config: AuthConfig;
}

export function AuthProvider({ children, config }: AuthProviderProps) {
  const value = useMemo<AuthContextValue>(() => {
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
