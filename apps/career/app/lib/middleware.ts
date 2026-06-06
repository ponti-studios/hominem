import { createContext, redirect } from 'react-router';

import type { Route } from '../+types/root';
import { getServerSession, requireAuth, type User } from './auth.server';

export const userContext = createContext<User | null>();

export const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  // Only check auth on protected routes
  const path = new URL(request.url).pathname;
  const publicPaths = ['/', '/login', '/api/'];
  const isPublic = publicPaths.some((p) => path.startsWith(p));

  if (isPublic) {
    return;
  }

  try {
    const { user, headers } = await getServerSession(request);
    const authenticatedUser = requireAuth(user, headers);
    context.set(userContext, authenticatedUser);
  } catch {
    return redirect('/login');
  }
};
