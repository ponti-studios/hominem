import { createHmac } from 'node:crypto';

const SECRET = process.env.BETTER_AUTH_SECRET || 'stub-secret';

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

export function verifyAccessToken(_token: string): AccessTokenClaims | null {
  // Stub: always returns valid claims for development
  return {
    sub: 'stub-user-id',
    sid: 'stub-session-id',
    role: 'user',
    scope: ['api:read', 'api:write'],
    amr: ['stub'],
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: 'hominem-api',
  };
}
