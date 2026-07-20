import type { User } from '@hominem/auth/types';
import { authDb } from '@hominem/db';
import type { MiddlewareHandler } from 'hono';

import { betterAuthMcpServer, betterAuthServer, MCP_SCOPES } from '../auth/better-auth';
import type { AuthContext } from '../auth/types';
import { env } from '../env';

type AuthErrorCode = 'invalid_token' | 'expired_token' | 'invalid_session';
const E2E_AUTH_SECRET_HEADER = 'x-e2e-auth-secret';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: AuthContext;
    authError?: AuthErrorCode;
  }
}

function toAuthUser(user: {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null | undefined;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    image: user.image ?? null,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
  };
}

function isE2eProxyAuthAllowed(c: Parameters<MiddlewareHandler>[0]) {
  if (env.NODE_ENV === 'production') return false;
  if (!env.AUTH_E2E_ENABLED) return false;

  const expectedSecret = env.AUTH_E2E_SECRET;
  if (!expectedSecret) return false;

  return c.req.header(E2E_AUTH_SECRET_HEADER) === expectedSecret;
}

function isMcpRequest(path: string) {
  return path === '/api/mcp' || path.startsWith('/api/mcp/');
}

function parseScopes(value: string) {
  return value
    .split(/[ ,]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function getUser(userId: string): Promise<User | null> {
  return (
    (await authDb.selectFrom('user').selectAll().where('id', '=', userId).executeTakeFirst()) ??
    null
  );
}

function setAuthContext(c: Parameters<MiddlewareHandler>[0], input: AuthContext) {
  c.set('auth', input);
}

/**
 * Resolve the caller identity once at the API boundary. Route-specific middleware
 * may authorize the resolved context, but must not establish a second identity.
 */
export const authMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/auth')) {
      return await next();
    }

    if (isMcpRequest(path) && c.req.header('authorization')) {
      const mcpSession = await betterAuthMcpServer.api.getMcpSession({
        headers: c.req.raw.headers,
      });

      if (mcpSession) {
        const user = await getUser(mcpSession.userId);
        if (user) {
          setAuthContext(c, {
            user,
            userId: user.id,
            credential: 'mcp-oauth',
            scopes: mcpSession.scopes.split(' ').filter(Boolean),
          });
          return await next();
        }
      }
    }

    const betterAuthSession = await betterAuthServer.api.getSession({
      headers: c.req.raw.headers,
    });

    const userId = betterAuthSession?.user?.id;
    const sessionId = betterAuthSession?.session?.id;

    if (userId && sessionId) {
      setAuthContext(c, {
        user: toAuthUser(betterAuthSession.user),
        userId,
        sessionId,
        credential: 'session',
        scopes: isMcpRequest(path) && env.NODE_ENV !== 'production' ? [...MCP_SCOPES] : [],
      });
      return await next();
    }

    // E2E-only: proxy user identity for cross-origin browser tests where
    // SameSite=Lax prevents session cookies from being sent.
    const proxyUserId = c.req.header('x-user-id');
    if (proxyUserId && isE2eProxyAuthAllowed(c)) {
      setAuthContext(c, {
        userId: proxyUserId,
        user: {
          id: proxyUserId,
          email: `proxy-${proxyUserId.slice(0, 8)}@hominem.e2e`,
          emailVerified: true,
          name: 'Proxy User',
          image: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as User,
        credential: 'e2e',
        scopes: isMcpRequest(path) ? parseScopes(c.req.header('x-mcp-scopes') ?? '') : [],
      });
    }

    return await next();
  };
};
