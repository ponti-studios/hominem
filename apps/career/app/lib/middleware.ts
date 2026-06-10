import { CareerRepository, db } from '@hominem/db';
import type { CareerPortfolioRecord } from '@hominem/db';
import { createContext, redirect } from 'react-router';

import type { Route } from '../+types/root';
import { getServerSession, type User } from './auth.server';

export const userContext = createContext<User | null>(null);
export const portfolioContext = createContext<CareerPortfolioRecord | null>(null);

// Routes where an authenticated user with no portfolio is redirected to /onboarding.
// Everything not listed here (/, /account, /onboarding, /api/*, /health, /p/*, /demo, /resume/*) is exempt.
const PORTFOLIO_REQUIRED_PREFIXES = [
  '/work',
  '/skills',
  '/social',
  '/stats',
  '/projects',
  '/testimonials',
  '/applications',
  '/certifications',
];

function requiresPortfolio(path: string): boolean {
  return PORTFOLIO_REQUIRED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

export const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  const path = new URL(request.url).pathname;
  const isPublic =
    path === '/' || path.startsWith('/login') || path.startsWith('/p/') || path === '/health';

  if (isPublic) return;

  const { user } = await getServerSession(request);
  if (!user) return redirect('/login');
  context.set(userContext, user);

  const portfolio = await CareerRepository.getPortfolioByUserId(db, user.id);
  context.set(portfolioContext, portfolio ?? null);

  if (requiresPortfolio(path) && !portfolio) {
    return redirect('/onboarding');
  }
};
