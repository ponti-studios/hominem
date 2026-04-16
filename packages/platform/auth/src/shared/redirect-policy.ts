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
