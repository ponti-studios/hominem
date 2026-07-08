import { createContext, useContext } from 'react';

import type { RawHonoClient } from '../core/raw-client';

export const HonoClientContext = createContext<RawHonoClient | null>(null);

export function useApiClient(): RawHonoClient {
  const client = useContext(HonoClientContext);
  if (!client) {
    throw new Error('useApiClient must be used within HonoProvider');
  }
  return client;
}
