import { getSetCookieHeaders } from '@hominem/auth/server-utils';

import { env } from '../env';

interface RequestHeadersLike {
  header(name: string): string | undefined;
}

interface RequestContextLike {
  req: RequestHeadersLike;
}

export function getClientIp(c: RequestContextLike) {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded && forwarded.length > 0) {
    const [first] = forwarded.split(',');
    return first?.trim() ?? 'unknown';
  }
  return c.req.header('x-real-ip') ?? 'unknown';
}

export function copyHeadersWithSetCookie(headers: Headers): Headers {
  const copied = new Headers(headers);
  const setCookies = getSetCookieHeaders(headers);

  if (setCookies.length > 0) {
    copied.delete('set-cookie');
    for (const setCookie of setCookies) {
      copied.append('set-cookie', setCookie);
    }
  }

  return copied;
}

export function buildBetterAuthUrl(input: {
  request: Request;
  path?: string | undefined;
  preserveQuery?: boolean | undefined;
}) {
  const requestUrl = new URL(input.request.url);
  const targetPath = input.path ? `/api/auth${input.path}` : requestUrl.pathname;
  const targetUrl = new URL(targetPath, env.API_URL);

  if (input.preserveQuery) {
    targetUrl.search = requestUrl.search;
  }

  return targetUrl;
}

export function ensureTrustedOrigin(headers: Headers) {
  const existingOrigin = headers.get('origin');
  if (existingOrigin && existingOrigin.length > 0) {
    return;
  }

  headers.set('origin', env.API_URL);
}
