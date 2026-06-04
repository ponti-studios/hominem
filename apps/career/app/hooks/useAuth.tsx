import { useRouteLoaderData } from 'react-router';

import type { User } from '../lib/auth.server';

export interface CurrentPortfolioSummary {
  id: string;
  title: string;
  slug: string;
}

/**
 * Get the authenticated user from the root loader data
 * This provides server-side user data that's available immediately on page load
 */
export const useUser = (): User | null => {
  const rootData = useRouteLoaderData('root') as
    | { user: User | null; currentPortfolio: CurrentPortfolioSummary | null }
    | undefined;
  return rootData?.user ?? null;
};

export const useCurrentPortfolio = (): CurrentPortfolioSummary | null => {
  const rootData = useRouteLoaderData('root') as
    | { currentPortfolio: CurrentPortfolioSummary | null }
    | undefined;
  return rootData?.currentPortfolio ?? null;
};
