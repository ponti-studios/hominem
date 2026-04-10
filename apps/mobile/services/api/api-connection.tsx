import React, {
  createContext,
  useMemo,
  type PropsWithChildren,
} from 'react';

type ApiConnectionContextValue = {
  status: 'connected';
  isReconnecting: false;
  pingApiNow: () => void;
};

const ApiConnectionContext = createContext<ApiConnectionContextValue | null>(null);

export function ApiConnectionProvider({ children }: PropsWithChildren) {
  const value = useMemo<ApiConnectionContextValue>(
    () => ({
      status: 'connected',
      isReconnecting: false,
      pingApiNow: () => {},
    }),
    [],
  );

  return <ApiConnectionContext.Provider value={value}>{children}</ApiConnectionContext.Provider>;
}

export function ApiReconnectChip() {
  return null;
}