import { getServerAuth } from '@hominem/auth/server';
import { db, UserRepository } from '@hominem/db';
import { logger } from '@hominem/telemetry';
import { createMiddleware } from 'hono/factory';

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

  // Test override for user (matching legacy RPC pattern)
  if (process.env.NODE_ENV === 'test') {
    const testUserId = c.req.header('x-user-id');
    if (testUserId) {
      const localUser = await UserRepository.findByIdOrEmail(db, {
        id: testUserId,
      });

      if (localUser) {
        c.set('user', {
          id: localUser.id,
          email: localUser.email,
          name: localUser.name ?? undefined,
          image: localUser.image ?? undefined,
          isAdmin: false,
          createdAt: localUser.createdAt ?? new Date().toISOString(),
          updatedAt: localUser.updatedAt ?? new Date().toISOString(),
        });
        c.set('userId', localUser.id);
      }

      await next();

      // Apply response headers
      responseHeaders.forEach((value, key) => {
        c.header(key, value);
      });
      return;
    }
  }

  // Production: Get auth from Better Auth-backed API session
  try {
    const request = c.req.raw;
    const authConfig = {
      apiBaseUrl: process.env.API_URL || 'http://localhost:3000',
    };

    const { user, headers } = await getServerAuth(request, authConfig);

    // Copy auth headers (cookies) to response headers
    headers.forEach((value, key) => {
      responseHeaders.append(key, value);
    });

    if (user) {
      c.set('user', user);
      c.set('userId', user.id);
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
