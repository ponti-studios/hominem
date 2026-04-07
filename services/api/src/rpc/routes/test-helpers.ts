/**
 * Shared test helpers for RPC route tests.
 * Reduces boilerplate across notes, chats, files, and voice route tests.
 */

import type { User } from '@hominem/auth/server';
import type { Hono } from 'hono';

import type { AppContext } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';

/**
 * Create a mock user for testing.
 * All tests use the same consistent user ID and metadata.
 */
export function createTestUser(overrides?: Partial<User>): User {
  const nowIso = '2026-04-02T12:00:00.000Z';
  const testUserId = '00000000-0000-4000-8000-000000000001';

  return {
    id: testUserId,
    email: 'test@hominem.test',
    emailVerified: false,
    image: null,
    name: 'Test User',
    createdAt: new Date(nowIso),
    updatedAt: new Date(nowIso),
    ...overrides,
  };
}

/**
 * Create a Hono app with auth context and error handling pre-configured.
 * The app will have a test user set in the auth middleware.
 */
export function createTestApp(userId?: string): Hono<AppContext> {
  const app = new Hono<AppContext>().onError(apiErrorHandler);

  const testUser = createTestUser({ id: userId });

  app.use('/*', async (c, next) => {
    c.set('user', testUser);
    c.set('userId', testUser.id);
    await next();
  });

  return app;
}

/**
 * Make a POST request to the test app with JSON body.
 */
export async function postJson(
  app: Hono<AppContext>,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make a PATCH request to the test app with JSON body.
 */
export async function patchJson(
  app: Hono<AppContext>,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

/**
 * Make a DELETE request to the test app.
 */
export async function deleteJson(app: Hono<AppContext>, path: string): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Make a GET request to the test app.
 */
export async function getJson(app: Hono<AppContext>, path: string): Promise<Response> {
  return app.request(`http://localhost${path}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
