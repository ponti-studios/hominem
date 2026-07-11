function normalizeRedirectPrefix(prefix: string) {
  const normalized = new URL(prefix, 'http://localhost').pathname;
  return normalized.endsWith('/') && normalized !== '/' ? normalized.slice(0, -1) : normalized;
}

function isAllowedRedirectPath(pathname: string, allowedPrefixes: string[]) {
  for (const prefix of allowedPrefixes) {
    const normalizedPrefix = normalizeRedirectPrefix(prefix);
    if (pathname === normalizedPrefix) return true;
    if (normalizedPrefix !== '/' && pathname.startsWith(`${normalizedPrefix}/`)) return true;
  }
  return false;
}

type AuthRedirectResolution = {
  safeRedirect: string;
  rejectedReason: 'missing' | 'non_local' | 'protocol_relative' | 'disallowed' | null;
  rejectedPathname: string | null;
};

function getRejectedReason(next?: string) {
  if (!next || next.length === 0) {
    return 'missing';
  }
  if (!next.startsWith('/')) {
    return 'non_local';
  }
  if (next.startsWith('//')) {
    return 'protocol_relative';
  }
  return null;
}

export function resolveAuthRedirect(
  next: string | null | undefined,
  fallback: string,
  allowedPrefixes: string[] = [fallback],
): AuthRedirectResolution {
  const rejectedReason = getRejectedReason(next ?? undefined);

  if (rejectedReason) {
    return {
      safeRedirect: fallback,
      rejectedReason,
      rejectedPathname: null,
    };
  }

  const url = new URL(next!, 'http://localhost');
  if (!isAllowedRedirectPath(url.pathname, allowedPrefixes)) {
    return {
      safeRedirect: fallback,
      rejectedReason: 'disallowed',
      rejectedPathname: url.pathname,
    };
  }

  return {
    safeRedirect: `${url.pathname}${url.search}${url.hash}`,
    rejectedReason: null,
    rejectedPathname: null,
  };
}

/**
 * Resolves a resume URL for Better Auth's MCP/OIDC authorize flow, which
 * redirects unauthenticated requests to a configured `loginPage` with the
 * original authorize query string attached (see
 * better-auth/plugins/mcp/authorize.ts). After login, the browser must
 * navigate back to that same authorize endpoint (same query string) on the
 * API's own origin so the newly-established session cookie is sent and the
 * flow can resume — a plain in-app redirect can't do this since it's a
 * different origin.
 *
 * This is not an open-redirect risk: the destination host+path is always
 * `${apiBaseUrl}/api/auth/mcp/authorize`, a trusted config value never taken
 * from the query string. Only the query string itself is forwarded verbatim.
 */
export function resolveOAuthResumeUrl(search: string, apiBaseUrl: string): string | null {
  const params = new URLSearchParams(search);
  const responseType = params.get('response_type');
  const clientId = params.get('client_id');
  const redirectUri = params.get('redirect_uri');

  if (responseType !== 'code' || !clientId || !redirectUri) {
    return null;
  }

  const url = new URL('/api/auth/mcp/authorize', apiBaseUrl);
  url.search = search;
  return url.toString();
}
