import type { PortfolioRecord } from '@hominem/db';
import { createContext, redirect, type RouterContext } from 'react-router';

import { getServerSession, type User } from './auth.server';
import { ensureUserPortfolio } from './portfolio.server';

export const userContext = createContext<User | null>(null);
export const portfolioContext = createContext<PortfolioRecord | null>(null);

type MiddlewareContext = {
  get: <T>(key: RouterContext<T>) => T;
  set: <T>(key: RouterContext<T>, value: T) => void;
};

type SharedMiddlewareArgs = {
  request: Request;
  context: MiddlewareContext;
};

type SharedMiddlewareNext = () => Promise<Response>;

function isApiRequest(path: string): boolean {
  return path === '/api' || path.startsWith('/api/');
}

function unauthorizedResponse(path: string) {
  if (isApiRequest(path)) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  return redirect('/login');
}

export async function sessionMiddleware(
  { request, context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  if (new URL(request.url).pathname === '/health') {
    return next();
  }

  const { user } = await getServerSession(request);
  if (user) {
    context.set(userContext, user);
  }

  return next();
}

export async function requireAuthMiddleware(
  { request, context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  const path = new URL(request.url).pathname;
  const user = context.get(userContext);

  if (!user) {
    return unauthorizedResponse(path);
  }

  return next();
}

export async function loadPortfolioMiddleware(
  { request, context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  const user = context.get(userContext);
  if (!user) {
    return next();
  }

  // Ensure a single portfolio exists for every signed-in user (created on first access).
  const currentPortfolio = await ensureUserPortfolio(request, user);
  context.set(portfolioContext, currentPortfolio);

  return next();
}

export async function requirePortfolioMiddleware(
  { context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  const user = context.get(userContext);
  if (!user) {
    return redirect('/login');
  }

  const currentPortfolio = context.get(portfolioContext);
  if (!currentPortfolio) {
    // Should not happen after ensureUserPortfolio; keep a hard fail-safe.
    return redirect('/work');
  }

  return next();
}
