import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../env';

const SECRET = env.BETTER_AUTH_SECRET;

export interface AccessTokenPayload {
  sub: string;
  sid: string;
  role?: 'user' | 'admin';
  scope?: string[];
  amr?: string[];
}

export interface IssuedAccessToken {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  role: 'user' | 'admin';
  scope: string[];
  amr: string[];
  auth_time: number;
  exp: number;
  iat: number;
  iss: string;
}

export function issueAccessToken(payload: AccessTokenPayload): IssuedAccessToken {
  const claims = {
    ...payload,
    role: payload.role ?? 'user',
    scope: payload.scope ?? ['api:read', 'api:write'],
    amr: payload.amr ?? ['stub'],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    auth_time: Math.floor(Date.now() / 1000),
    iss: 'hominem-api',
  };

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  const accessToken = `${header}.${body}.${signature}`;

  return {
    accessToken,
    expiresIn: 3600,
    tokenType: 'Bearer',
  };
}

export function verifyAccessToken(token: string): AccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;

  try {
    const parsedHeader = JSON.parse(Buffer.from(header, 'base64url').toString('utf8'));
    if (parsedHeader.alg !== 'HS256') return null;

    const expectedSignature = createHmac('sha256', SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    const actual = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }

    const claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as AccessTokenClaims;
    if (typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    if (claims.iss !== 'hominem-api') return null;
    if (!claims.sub || !claims.sid) return null;

    return claims;
  } catch {
    return null;
  }
}
