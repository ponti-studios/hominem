import { useRouteLoaderData } from 'react-router';

import type { User } from '../lib/auth.server';

type RootLoaderData = {
  user: User | null;
  hasPortfolio?: boolean;
};

/**
 * Get the authenticated user from the root loader data
 * This provides server-side user data that's available immediately on page load
 */
export const useUser = (): User | null => {
  const rootData = useRouteLoaderData('root') as RootLoaderData | undefined;
  return rootData?.user ?? null;
};

/** True when the signed-in user has a portfolio (product nav is available). */
export const useHasPortfolio = (): boolean => {
  const rootData = useRouteLoaderData('root') as RootLoaderData | undefined;
  return rootData?.hasPortfolio ?? false;
};
