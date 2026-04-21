import type { ClientConfig } from '@hakumi/rpc';
import { HonoProvider as BaseHonoProvider } from '@hakumi/rpc/react';
import { logger } from '@hakumi/utils/logger';
import type { QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { useAuth } from '~/services/auth/auth-provider';
import { API_BASE_URL } from '~/constants';

export const ApiProvider = ({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient?: QueryClient;
}) => {
  const { getAuthHeaders } = useAuth();
  const config: ClientConfig = {
    baseUrl: API_BASE_URL,
    getHeaders: getAuthHeaders,
    onError: (error: Error) => {
      logger.error('Mobile Hono RPC Error', error);
    },
  };

  return (
    <BaseHonoProvider config={config} queryClient={queryClient}>
      {children}
    </BaseHonoProvider>
  );
};
