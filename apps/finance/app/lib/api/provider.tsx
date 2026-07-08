import type { ClientConfig } from '@hominem/rpc';
import { HonoProvider as BaseHonoProvider } from '@hominem/rpc/react';
import type { ReactNode } from 'react';

interface HonoProviderProps {
  children: ReactNode;
  baseUrl: string;
}

// Always renders on client — hooks called unconditionally
function HonoClientProvider({ children, baseUrl }: HonoProviderProps) {
  // RPC calls are same-origin and authenticate via the Better Auth session
  // cookie (the client already sends credentials: 'include') — no
  // Authorization header is needed or valid here.
  const config: ClientConfig = { baseUrl, onError: (e) => console.error('Hono RPC Error:', e) };

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
