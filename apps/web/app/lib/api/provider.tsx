import type { ClientConfig } from '@hakumi/rpc';
import { HonoProvider as BaseHonoProvider } from '@hakumi/rpc/react';
import type { ReactNode } from 'react';

import { getQueryClient } from '~/lib/get-query-client';

interface HonoProviderProps {
  children: ReactNode;
  baseUrl: string;
}

export function HonoProvider({ children, baseUrl }: HonoProviderProps) {
  const config: ClientConfig = {
    baseUrl,
    onError: () => {
      // Errors are handled via React Query's error state
    },
  };

  return (
    <BaseHonoProvider queryClient={getQueryClient()} config={config}>
      {children}
    </BaseHonoProvider>
  );
}
