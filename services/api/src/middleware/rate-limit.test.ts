import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { clientIpMiddleware } from './client-ip';
import { checkOtpSendLimits, otpSendLimit, rateLimit, type RateLimitCounter } from './rate-limit';

function memoryCounter(): RateLimitCounter {
  const counts = new Map<string, number>();
  return async (key) => {
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    return next;
  };
}

const brokenCounter: RateLimitCounter = async () => {
  throw new Error('redis down');
};

const dev = { originGuardActive: false, production: false };

function appWith(...mw: Parameters<Hono['use']>[1][]) {
  const app = new Hono().use('*', clientIpMiddleware(dev));
  for (const m of mw) app.use('*', m);
  return app.all('*', (c) => c.text('ok'));
}

describe('rateLimit', () => {
  it('trips after the limit and sends Retry-After', async () => {
    const app = appWith(
      rateLimit({ bucket: 't', limit: 2, windowSec: 60, counter: memoryCounter() }),
    );
    const hit = () => app.request('/x', { headers: { 'x-forwarded-for': '203.0.113.1' } });
    expect((await hit()).status).toBe(200);
    expect((await hit()).status).toBe(200);
    const res = await hit();
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('60');
  });

  it('counts each IP separately', async () => {
    const app = appWith(
      rateLimit({ bucket: 't', limit: 1, windowSec: 60, counter: memoryCounter() }),
    );
    const hit = (ip: string) => app.request('/x', { headers: { 'x-forwarded-for': ip } });
    expect((await hit('203.0.113.1')).status).toBe(200);
    expect((await hit('203.0.113.2')).status).toBe(200);
    expect((await hit('203.0.113.1')).status).toBe(429);
  });

  it('fails open on a Redis outage by default', async () => {
    const app = appWith(
      rateLimit({ bucket: 't', limit: 1, windowSec: 60, counter: brokenCounter }),
    );
    expect((await app.request('/x')).status).toBe(200);
  });

  it('fails closed on a Redis outage when asked to', async () => {
    const app = appWith(
      rateLimit({ bucket: 't', limit: 1, windowSec: 60, counter: brokenCounter, failClosed: true }),
    );
    expect((await app.request('/x')).status).toBe(503);
  });
});

describe('otp send limits', () => {
  const send = (app: Hono, email: string, ip: string) =>
    app.request('/otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({ email }),
    });

  it('caps per email even when the IP header keeps rotating', async () => {
    const app = appWith(otpSendLimit(memoryCounter()));
    const statuses = [];
    for (let i = 1; i <= 5; i++)
      statuses.push((await send(app, 'a@example.com', `203.0.113.${i}`)).status);
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });

  it('treats email case and spacing the same', async () => {
    const counter = memoryCounter();
    for (let i = 0; i < 3; i++) {
      await checkOtpSendLimits({ counter, email: ' A@Example.com ', ip: `10.0.0.${i}` });
    }
    expect(await checkOtpSendLimits({ counter, email: 'a@example.com', ip: '10.0.0.9' })).toBe(
      'limited',
    );
  });

  it('leaves other emails alone', async () => {
    const app = appWith(otpSendLimit(memoryCounter()));
    for (let i = 0; i < 4; i++) await send(app, 'a@example.com', '203.0.113.1');
    expect((await send(app, 'b@example.com', '203.0.113.2')).status).toBe(200);
  });

  it('fails closed when Redis is down', async () => {
    const app = appWith(otpSendLimit(brokenCounter));
    expect((await send(app, 'a@example.com', '203.0.113.1')).status).toBe(503);
  });
});
