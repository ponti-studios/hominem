import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { originGuard } from './origin-guard';

const app = (secret: string) =>
  new Hono()
    .use('*', originGuard(secret))
    .get('/healthz', (c) => c.text('ok'))
    .get('/api/status', (c) => c.text('ok'));

describe('origin guard', () => {
  it('lets everything through when no secret is configured', async () => {
    expect((await app('').request('/api/status')).status).toBe(200);
  });

  it('rejects requests without the secret', async () => {
    expect((await app('s3cret').request('/api/status')).status).toBe(403);
  });

  it('rejects the wrong secret', async () => {
    const res = await app('s3cret').request('/api/status', {
      headers: { 'x-origin-secret': 'nope' },
    });
    expect(res.status).toBe(403);
  });

  it('accepts the right secret', async () => {
    const res = await app('s3cret').request('/api/status', {
      headers: { 'x-origin-secret': 's3cret' },
    });
    expect(res.status).toBe(200);
  });

  it('exempts the health check', async () => {
    expect((await app('s3cret').request('/healthz')).status).toBe(200);
  });

  it('does not trust a spoofed internal Host on public (proxied) traffic', async () => {
    const res = await app('s3cret').request('/api/status', {
      headers: { host: 'hominem-api.internal', 'fly-client-ip': '203.0.113.9' },
    });
    expect(res.status).toBe(403);
  });

  it('exempts the private network host', async () => {
    const res = await app('s3cret').request('/api/status', {
      headers: { host: 'hominem-api.internal:4040' },
    });
    expect(res.status).toBe(200);
  });
});
