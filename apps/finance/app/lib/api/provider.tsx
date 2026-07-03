import { useAuthContext, useSafeAuth } from '@hominem/auth';
import type { ClientConfig } from '@hominem/rpc';
import { HonoProvider as BaseHonoProvider } from '@hominem/rpc/react';
import { useCallback } from 'react';
import type { ReactNode } from 'react';

interface HonoProviderProps {
  children: ReactNode;
  baseUrl: string;
}

// Always renders on client — hooks called unconditionally
function HonoClientProvider({ children, baseUrl }: HonoProviderProps) {
  const authContext = useSafeAuth();
  const { authClient } = useAuthContext();

  const getHeaders = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const session = await authClient.getSession();
      const token = (session as any)?.data?.session?.token;
      if (token) return { authorization: `Bearer ${token}` };
    } catch {
      // ignore
    }
    return {};
  }, [authClient]);

  const config: ClientConfig = authContext
    ? { baseUrl, getHeaders, onError: (e) => console.error('Hono RPC Error:', e) }
    : { baseUrl, getHeaders: async () => ({}), onError: (e) => console.error('Hono RPC Error:', e) };

  return <BaseHonoProvider config={config}>{children}</BaseHonoProvider>;
}

// SSR-safe wrapper — no hooks called here, delegates to HonoClientProvider on client
export function HonoProvider({ children, baseUrl }: HonoProviderProps) {
  if (typeof window === 'undefined') {
    // SSR: skip all React Query / auth providers
    return <>{children}</>;
  }

  return <HonoClientProvider baseUrl={baseUrl}>{children}</HonoClientProvider>;
}
