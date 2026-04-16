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

interface BetterAuthSessionContext {
  auth: AuthContextEnvelope;
    user: User;
  userId: string;
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
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function setAuthContext(
  c: {
    set: <K extends keyof BetterAuthSessionContext>(
      key: K,
      value: BetterAuthSessionContext[K],
    ) => void;
  },
  input: { user: User; sessionId: string; amr: string[]; authTime?: number },
) {
  c.set('user', input.user);
  c.set('userId', input.user.id);
  c.set('auth', {
    sub: input.user.id,
    sid: input.sessionId,
    scope: ['api:read', 'api:write'],
    role: 'user',
    amr: input.amr,
    authTime: input.authTime ?? Math.floor(Date.now() / 1000),
  });
}

async function applyBetterAuthSession(c: {
  req: { raw: Request };
  set: <K extends keyof BetterAuthSessionContext>(
    key: K,
    value: BetterAuthSessionContext[K],
  ) => void;
}) {
  const betterAuthSession = await betterAuthServer.api.getSession({
    headers: c.req.raw.headers,
  });

  const betterAuthUserId = betterAuthSession?.user?.id;
  const betterAuthSessionId = betterAuthSession?.session?.id;

  if (!betterAuthUserId || !betterAuthSessionId) {
    return false;
  }

  setAuthContext(c, {
    user: toAuthUser(betterAuthSession.user),
    sessionId: betterAuthSessionId,
    amr: ['better-auth-session'],
  });

  return true;
}

export const authJwtMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/auth')) {
      return await next();
    }

    await applyBetterAuthSession(c);
    return await next();
  };
};
