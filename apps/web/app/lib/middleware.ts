import type { User } from '@hominem/auth/types';
import { createContext, redirect } from 'react-router';

import type { Route } from '../+types/root';
import { getServerSession } from './auth.server';

export const userContext = createContext<User | null>(null);

export const authMiddleware: Route.MiddlewareFunction = async ({ request, context }) => {
  const path = new URL(request.url).pathname;

  // Public paths that don't require authentication
  const publicPaths = ['/', '/auth'];

  const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + '/'));

  const { user } = await getServerSession(request);

  if (user) {
    context.set(userContext, user);
  } else if (!isPublic) {
    throw redirect('/auth');
  }
};
