import type { User } from '@hominem/auth/types';
import type { MiddlewareHandler } from 'hono';

import { betterAuthServer } from '../auth/better-auth';
import type { AuthContextEnvelope } from '../auth/types';

type AuthErrorCode = 'invalid_token' | 'expired_token' | 'invalid_session';

declare module 'hono' {
  interface ContextVariableMap {
    auth?: AuthContextEnvelope;
    user?: User;
    userId?: string;
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

function setAuthContext(
  c: {
    set: (key: 'user' | 'userId' | 'auth', value: User | string | AuthContextEnvelope) => void;
  },
  input: { user: User; sessionId: string },
) {
  c.set('user', input.user);
  c.set('userId', input.user.id);
  c.set('auth', {
    sub: input.user.id,
    sid: input.sessionId,
    authTime: Math.floor(Date.now() / 1000),
  });
}

/**
 * Resolve the caller identity via Better Auth only (session cookies or BA bearer).
 * Custom JWT issuance is intentionally unsupported.
 */
export const authJwtMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/auth')) {
      return await next();
    }

    const betterAuthSession = await betterAuthServer.api.getSession({
      headers: c.req.raw.headers,
    });

    const userId = betterAuthSession?.user?.id;
    const sessionId = betterAuthSession?.session?.id;

    if (userId && sessionId) {
      setAuthContext(c, {
        user: toAuthUser(betterAuthSession.user),
        sessionId,
      });
      return await next();
    }

    // Non-prod: accept x-user-id for cross-origin e2e where SameSite=Lax
    // prevents session cookies from being sent.
    if (process.env.NODE_ENV !== 'production') {
      const proxyUserId = c.req.header('x-user-id');
      if (proxyUserId) {
        c.set('userId', proxyUserId);
        c.set('user', {
          id: proxyUserId,
          email: `proxy-${proxyUserId.slice(0, 8)}@hominem.e2e`,
          emailVerified: true,
          name: 'Proxy User',
          image: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as User);
      }
    }

    return await next();
  };
};
