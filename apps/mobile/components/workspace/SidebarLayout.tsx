import React, { createContext, useContext, useMemo } from 'react';
import { Platform } from 'react-native';

type SidebarLayoutContextValue = {
  isSidebarPinned: boolean;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null);

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const isSidebarPinned = Platform.OS === 'ios' && Platform.isPad;

  const value = useMemo<SidebarLayoutContextValue>(
    () => ({
      isSidebarPinned,
    }),
    [isSidebarPinned],
  );

  return <SidebarLayoutContext.Provider value={value}>{children}</SidebarLayoutContext.Provider>;
}

export function useSidebarLayout() {
  const value = useContext(SidebarLayoutContext);

  if (!value) {
    throw new Error('useSidebarLayout must be used within SidebarLayout');
  }

  return value;
}
