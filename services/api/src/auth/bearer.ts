import { isSessionRevoked } from './session-store';
import { verifyAccessToken } from './tokens';
import type { AccessTokenClaims } from './tokens';

export function getBearerToken(headerValue?: string | null): string | null {
  if (!headerValue || !headerValue.startsWith('Bearer ')) return null;
  return headerValue.slice(7);
}

export interface ResolvedBearerAuth {
  claims: AccessTokenClaims;
}

export async function resolveBearerAuth(
  headerValue?: string | null,
): Promise<ResolvedBearerAuth | null> {
  const token = getBearerToken(headerValue);
  if (!token) return null;

  const claims = verifyAccessToken(token);
  if (!claims) return null;

  if (await isSessionRevoked(claims.sid)) return null;

  return { claims };
}
