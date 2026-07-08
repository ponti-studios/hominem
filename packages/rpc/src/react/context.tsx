import { createContext, useContext } from 'react';

import type { HonoClient } from '../core/api-client';

export const HonoClientContext = createContext<HonoClient | null>(null);

export function useApiClient(): HonoClient {
  const client = useContext(HonoClientContext);
  if (!client) {
    throw new Error('useApiClient must be used within HonoProvider');
  }
  return client;
}
