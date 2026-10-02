import { authDb } from '@hominem/db/core';
import type { AuthUser } from '@ponti-studios/auth/types';
import type { MiddlewareHandler } from 'hono';

import { betterAuthServer } from '../auth/better-auth';
import type { AuthContext } from '../auth/types';

type VerifiedJwtClaims = {
  sub?: unknown;
  scope?: unknown;
  client_id?: unknown;
};

type AuthErrorCode = 'invalid_token' | 'expired_token' | 'invalid_session';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: AuthContext;
    authError?: AuthErrorCode;
  }
}

// The slice of Better Auth's session lookup this middleware reads, so a test can supply a
// plain double instead of the full server.
type SessionLookup = {
  api: {
    getSession: (input: { headers: Headers }) => Promise<{
      user: {
        id: string;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null;
        createdAt: Date | string;
        updatedAt: Date | string;
      };
      session: { id: string };
    } | null>;
  };
};

function toAuthUser(
  session: NonNullable<Awaited<ReturnType<SessionLookup['api']['getSession']>>>,
): AuthUser {
  const user = session.user;
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

async function getUser(userId: string): Promise<AuthUser | null> {
  return (
    (await authDb.selectFrom('user').selectAll().where('id', '=', userId).executeTakeFirst()) ??
    null
  );
}

function setAuthContext(c: Parameters<MiddlewareHandler>[0], input: AuthContext) {
  c.set('auth', input);
}

// Figures out who's calling, once, at the API boundary. Route middleware can
// authorize based on this, but shouldn't set up a second identity of its own.
export function createAuthMiddleware(auth: SessionLookup = betterAuthServer): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.path.startsWith('/api/auth')) {
      return await next();
    }

    const betterAuthSession = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    const userId = betterAuthSession?.user?.id;
    const sessionId = betterAuthSession?.session?.id;

    if (userId && sessionId) {
      setAuthContext(c, {
        user: toAuthUser(betterAuthSession),
        userId,
        sessionId,
        credential: 'session',
        scopes: [],
      });
      return await next();
    }

    return await next();
  };
}

export async function setMcpAuthContext(
  c: Parameters<MiddlewareHandler>[0],
  claims: VerifiedJwtClaims,
  credential: 'mcp-oauth' | 'mcp-token' = 'mcp-oauth',
): Promise<boolean> {
  const userId = typeof claims.sub === 'string' ? claims.sub : null;
  if (!userId) return false;

  const user = await getUser(userId);
  if (!user) return false;

  const scopes = typeof claims.scope === 'string' ? claims.scope.split(' ').filter(Boolean) : [];
  const clientId = typeof claims.client_id === 'string' ? claims.client_id : undefined;

  setAuthContext(c, {
    user,
    userId: user.id,
    clientId,
    credential,
    scopes,
  });
  return true;
}
