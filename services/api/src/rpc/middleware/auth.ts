import type { User } from '@hominem/auth/types';
import { createMiddleware } from 'hono/factory';

import { UnauthorizedError } from '../errors';

export interface AuthEnvelope {
  sub: string;
  sid: string;
  scope: string[];
  role: 'user' | 'admin';
  amr: string[];
  authTime: number;
}

export interface AppContext {
  Variables: {
    user?: User;
    userId?: string;
    auth?: AuthEnvelope;
    authError?:
      | 'invalid_token'
      | 'expired_token'
      | 'invalid_audience'
      | 'invalid_issuer'
      | 'disallowed_kid'
      | 'revoked_session'
      | 'insufficient_scope';
    requestId?: string;
  };
  Bindings: Record<string, unknown>;
}

export const authMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const user = c.get('user');
  const userId = c.get('userId');
  const authError = c.get('authError');

  if (!user || !userId) {
    throw new UnauthorizedError('Authentication required', authError ? { authError } : undefined);
  }

  return await next();
});

export const publicMiddleware = createMiddleware<AppContext>(async (_c, next) => {
  return await next();
});

export const requestIdMiddleware = createMiddleware<AppContext>(async (c, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  c.set('requestId', requestId);
  return await next();
});
