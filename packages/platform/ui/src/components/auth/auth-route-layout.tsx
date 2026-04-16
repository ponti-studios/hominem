import type { ReactNode } from 'react';

import { Toaster } from '../toaster';

interface AuthRouteLayoutProps {
  children: ReactNode;
}

export function AuthRouteLayout({ children }: AuthRouteLayoutProps) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
