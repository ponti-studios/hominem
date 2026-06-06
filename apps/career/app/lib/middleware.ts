import { createContext, redirect } from 'react-router';

import type { Route } from '../+types/root';
import { getServerSession, type User } from './auth.server';

export const userContext = createContext<User | null>(null);

export const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  // Only check auth on protected routes
  const path = new URL(request.url).pathname;
  const publicPaths = ['/', '/login', '/p/'];
  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p));

  if (isPublic) {
    return;
  }

  const { user } = await getServerSession(request);
  if (!user) return redirect('/login');
  context.set(userContext, user);
};
