// Token handling stubs
import { createHmac } from 'node:crypto';

const SECRET = process.env.BETTER_AUTH_SECRET || 'stub-secret';

export function issueAccessToken(_payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(_payload)).toString('base64url');
  const signature = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyAccessToken(_token: string): Record<string, unknown> | null {
  // Stub: always returns valid
  return { sub: 'stub-user-id', email: 'stub@example.com' };
}
