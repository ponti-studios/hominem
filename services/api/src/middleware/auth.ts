import type { User } from '@hominem/auth/server';
import { toUser, UserAuthService } from '@hominem/auth/server';
import { db } from '@hominem/db';
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

const USER_CACHE_TTL_MS = 300_000; // 5 minutes
const USER_CACHE_MAX_ENTRIES = 1024;
const userCache = new Map<string, { user: User; expiresAt: number }>();

function getCachedUser(userId: string) {
  const cached = userCache.get(userId);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    userCache.delete(userId);
    return null;
  }

  return cached.user;
}

function setCachedUser(user: User) {
  if (userCache.size >= USER_CACHE_MAX_ENTRIES) {
    const first = userCache.keys().next().value;
    if (typeof first === 'string') {
      userCache.delete(first);
    }
  }

  userCache.set(user.id, {
    user,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  });
}

export function invalidateUserCache(userId: string) {
  userCache.delete(userId);
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

  const cached = getCachedUser(betterAuthUserId);
  if (cached) {
    c.set('user', cached);
    c.set('userId', cached.id);
    c.set('auth', {
      sub: cached.id,
      sid: betterAuthSessionId,
      scope: ['api:read', 'api:write'],
      role: 'user',
      amr: ['better-auth-session'],
      authTime: Math.floor(Date.now() / 1000),
    });
    return true;
  }

  const dbUser = await UserAuthService.getUserById(betterAuthUserId);
  if (!dbUser) {
    return false;
  }

  const user = toUser(dbUser);
  setCachedUser(user);
  c.set('user', user);
  c.set('userId', dbUser.id);
  c.set('auth', {
    sub: dbUser.id,
    sid: betterAuthSessionId,
    scope: ['api:read', 'api:write'],
    role: 'user',
    amr: ['better-auth-session'],
    authTime: Math.floor(Date.now() / 1000),
  });

  return true;
}

export const authJwtMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/auth') || path.startsWith('/api/better-auth')) {
      return await next();
    }

    if (process.env.NODE_ENV === 'test') {
      const testUserId = c.req.header('x-user-id');
      if (testUserId) {
        const cached = getCachedUser(testUserId);
        if (cached) {
          c.set('user', cached);
          c.set('userId', cached.id);
          c.set('auth', {
            sub: cached.id,
            sid: crypto.randomUUID(),
            scope: ['api:read', 'api:write'],
            role: 'user',
            amr: ['test-header'],
            authTime: Math.floor(Date.now() / 1000),
          });
          return await next();
        }

        const testUser = await UserAuthService.findByIdOrEmail({ id: testUserId });
        if (testUser) {
          const user = toUser(testUser);
          setCachedUser(user);
          c.set('user', user);
          c.set('userId', testUser.id);
          c.set('auth', {
            sub: testUser.id,
            sid: crypto.randomUUID(),
            scope: ['api:read', 'api:write'],
            role: 'user',
            amr: ['test-header'],
            authTime: Math.floor(Date.now() / 1000),
          });
          return await next();
        }

        await db
          .insertInto('user')
          .values({
            id: testUserId,
            email: `${testUserId}@hominem.test`,
            name: 'Test User',
          })
          .onConflict((oc) => oc.column('id').doNothing())
          .execute();

        const fallbackUser = await UserAuthService.getUserById(testUserId);

        if (fallbackUser) {
          const user = toUser(fallbackUser);
          setCachedUser(user);
          c.set('user', user);
        }

        c.set('auth', {
          sub: testUserId,
          sid: crypto.randomUUID(),
          scope: ['api:read', 'api:write'],
          role: 'user',
          amr: ['test-header'],
          authTime: Math.floor(Date.now() / 1000),
        });
        c.set('userId', testUserId);
        return await next();
      }
    }

    try {
      if (await applyBetterAuthSession(c)) {
        return await next();
      }
    } catch (error) {
      // Better Auth session lookup failed - continue to next middleware
    }

    return await next();
  };
};
