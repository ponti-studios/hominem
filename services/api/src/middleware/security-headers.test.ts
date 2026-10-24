import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { env } from '../env';

async function createApp(nodeEnv: 'production' | 'test') {
  const { securityHeadersMiddleware } = await import('./security-headers');
  return new Hono()
    .use('*', securityHeadersMiddleware({ ...env, NODE_ENV: nodeEnv }))
    .get('/api/status', (c) => c.json({ ok: true }))
    .get('/docs', (c) => c.html('<html><body>docs</body></html>'));
}

describe('security headers middleware', () => {
  it('adds API security headers and production HSTS', async () => {
    const app = await createApp('production');
    const response = await app.request('/api/status');

    expect(response.headers.get('content-security-policy')).toBe(
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    );
    expect(response.headers.get('permissions-policy')).toBe(
      'geolocation=(), microphone=(), camera=()',
    );
    expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers.has('x-frame-options')).toBe(false);
  });

  it('adds clickjacking protection and HSTS to HTML pages without an API-style CSP', async () => {
    const app = await createApp('production');
    const response = await app.request('/docs');

    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'none'");
    expect(response.headers.get('strict-transport-security')).toBe(
      'max-age=31536000; includeSubDomains',
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('does not clobber a CSP the page already set', async () => {
    const { securityHeadersMiddleware } = await import('./security-headers');
    const app = new Hono()
      .use('*', securityHeadersMiddleware({ ...env, NODE_ENV: 'production' }))
      .get('/credit', (c) => {
        c.header('Content-Security-Policy', "script-src 'nonce-abc'");
        return c.html('<html></html>');
      });
    const response = await app.request('/credit');

    expect(response.headers.get('content-security-policy')).toBe("script-src 'nonce-abc'");
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('skips HSTS outside production', async () => {
    const app = await createApp('test');
    const response = await app.request('/docs');

    expect(response.headers.has('strict-transport-security')).toBe(false);
  });
});
