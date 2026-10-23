import type { MiddlewareHandler } from 'hono';

import { env } from '../env';
import type { ApiEnv } from '../env.schema';

const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
// HTML pages (hosted login, logout, consent, legal) have inline scripts/styles, so the only CSP
// directive we can add everywhere is the one that stops clickjacking.
const PAGE_CONTENT_SECURITY_POLICY = "frame-ancestors 'none'";

function isApiResponse(path: string) {
  return path.startsWith('/api/') || path === '/openapi.json';
}

export function securityHeadersMiddleware(inputEnv: ApiEnv = env): MiddlewareHandler {
  return async (c, next) => {
    await next();

    if (!c.res.headers.has('Referrer-Policy')) {
      c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
    c.header('X-Content-Type-Options', 'nosniff');
    if (inputEnv.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    if (isApiResponse(c.req.path)) {
      c.header('Content-Security-Policy', API_CONTENT_SECURITY_POLICY);
      c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
      return;
    }

    // Pages that set their own CSP (the credit page's nonce one) keep it.
    c.header('X-Frame-Options', 'DENY');
    if (!c.res.headers.has('Content-Security-Policy')) {
      c.header('Content-Security-Policy', PAGE_CONTENT_SECURITY_POLICY);
    }
  };
}
