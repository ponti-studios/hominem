import { CareerRepository, db } from '@hominem/db';
import type { CareerPortfolioRecord } from '@hominem/db';
import { createContext, redirect, type RouterContext } from 'react-router';

import { getServerSession, type User } from './auth.server';

export const userContext = createContext<User | null>(null);
export const portfolioContext = createContext<CareerPortfolioRecord | null>(null);

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
  { context }: SharedMiddlewareArgs,
  next: SharedMiddlewareNext,
): Promise<Response | void> {
  const user = context.get(userContext);
  if (!user) {
    return next();
  }

  const currentPortfolio = await CareerRepository.getPortfolioByUserId(db, user.id);
  context.set(portfolioContext, currentPortfolio ?? null);

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
    return redirect('/onboarding');
  }

  return next();
}
