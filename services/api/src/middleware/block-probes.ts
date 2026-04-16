import type { MiddlewareHandler } from 'hono';

const PROBE_REGEXES: RegExp[] = [
  /^\/+(?:[^/]+\/)*wp-includes\/wlwmanifest\.xml$/i,
  /^\/+xmlrpc\.php$/i,
  /^\/+wp-(?:admin|login)\.php$/i,
  /^\/+\.git\/config$/i,
  /^\/+(?:phpmyadmin|adminer|pma)\/?.*$/i,
  /^\/+(?:\.env|wp-config\.php|configuration\.php)$/i,
  /^\/+dump(?:\.sql)?$/i,
];

export function blockMaliciousProbes(): MiddlewareHandler {
  return async (c, next) => {
    const path = c.req.path;
    for (const re of PROBE_REGEXES) {
      if (re.test(path)) {
        return c.text('Not found', 404);
      }
    }

    return await next();
  };
}
