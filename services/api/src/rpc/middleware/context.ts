import { logger } from '@hominem/utils/logger';
import { createMiddleware } from 'hono/factory';

import { betterAuthServer } from '../../auth/better-auth';
import type { AppContext } from './auth';

/**
 * Context Setup Middleware
 *
 * Runs on EVERY request to initialize context (similar to previous createContext patterns).
 * Sets up:
 * - User authentication from Better Auth session and bearer token material
 * - Response headers for cookies
 */
export const contextMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const responseHeaders = new Headers();

  // Production: Get auth from Better Auth-backed API session
  try {
    const session = await betterAuthServer.api.getSession({ headers: c.req.raw.headers });
    if (session?.user) {
      c.set('user', {
        id: session.user.id,
        email: session.user.email,
        emailVerified: session.user.emailVerified,
        name: session.user.name,
        image: session.user.image ?? null,
        createdAt: session.user.createdAt,
        updatedAt: session.user.updatedAt,
      });
      c.set('userId', session.user.id);
      c.set('auth', {
        sub: session.user.id,
        sid: session.session.id,
        scope: ['api:read', 'api:write'],
        role: 'user',
        amr: ['better-auth-session'],
        authTime: Math.floor(Date.now() / 1000),
      });
    }
  } catch (error) {
    logger.error('Error in context middleware', { error });
    // Continue without auth - let authMiddleware handle unauthorized access
  }

  await next();

  // Apply response headers (for cookies, etc)
  responseHeaders.forEach((value, key) => {
    c.header(key, value);
  });
});
