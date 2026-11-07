import { Hono } from 'hono';

import type { AppEnv } from '../../server';
import {
  buildSessionResponse,
  callBetterAuthPluginEndpoint,
  copyHeadersWithSetCookie,
  getBetterAuthSessionContext,
  jsonWithHeaders,
  type AuthDependencies,
} from './shared';

export function createAuthRoutes(dependencies: AuthDependencies) {
  const { auth } = dependencies;
  const authRoutes = new Hono<AppEnv>();

  // Session / logout reshape for first-party clients and the e2e helpers.
  // getServerAuth (packages/auth/src/server.ts) hits Better Auth's own
  // GET /api/auth/get-session directly; these routes stay for callers that POST
  // /api/auth/logout and for the session shape other clients still consume.

  authRoutes.get('/session', async (c) => {
    try {
      const betterAuthSession = await getBetterAuthSessionContext(c, auth);
      if (!betterAuthSession) {
        return c.json({ isAuthenticated: false, user: null }, 401);
      }

      const sessionResponse = await buildSessionResponse({
        sessionId: betterAuthSession.sessionId,
        userId: betterAuthSession.userId,
      });

      if (!sessionResponse) {
        return c.json({ isAuthenticated: false, user: null }, 401);
      }

      return c.json(sessionResponse);
    } catch {
      return c.json({ isAuthenticated: false, user: null }, 401);
    }
  });

  authRoutes.post('/logout', async (c) => {
    const response = await callBetterAuthPluginEndpoint({
      request: c.req.raw,
      path: '/sign-out',
      method: 'POST',
      dependencies,
    }).catch(() => null);
    const headers = response ? copyHeadersWithSetCookie(response.headers) : new Headers();
    return jsonWithHeaders({ success: true }, 200, headers);
  });

  return authRoutes;
}
