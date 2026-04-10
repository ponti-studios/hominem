import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

import { getAuthClient } from './auth-client';

export interface AuthConfig {
  apiBaseUrl: string;
}

type AuthContextValue = {
  apiBaseUrl: string;
  authClient: ReturnType<typeof getAuthClient>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  config: AuthConfig;
}

export function AuthProvider({ children, config }: AuthProviderProps) {
  const value = useMemo<AuthContextValue>(() => {
    return {
      apiBaseUrl: config.apiBaseUrl,
      authClient: getAuthClient(config.apiBaseUrl),
    };
  }, [config.apiBaseUrl]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthClient() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthClient must be used within AuthProvider');
  }
  return context.authClient;
}

export function useSession() {
  return useAuthClient().useSession();
}
