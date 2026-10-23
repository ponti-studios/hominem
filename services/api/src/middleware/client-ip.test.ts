import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { clientIpMiddleware, getClientIp } from './client-ip';

async function ipFor(
  options: { originGuardActive: boolean; production: boolean },
  headers: Record<string, string>,
) {
  const app = new Hono()
    .use('*', clientIpMiddleware(options))
    .get('/', (c) => c.text(getClientIp(c)));
  return (await app.request('/', { headers })).text();
}

describe('client ip', () => {
  const guarded = { originGuardActive: true, production: true };
  const unguarded = { originGuardActive: false, production: true };

  it('uses cf-connecting-ip once only Cloudflare can reach us', async () => {
    expect(
      await ipFor(guarded, { 'cf-connecting-ip': '198.51.100.7', 'fly-client-ip': '104.16.0.1' }),
    ).toBe('198.51.100.7');
  });

  it('ignores cf-connecting-ip when the origin guard is off', async () => {
    expect(
      await ipFor(unguarded, { 'cf-connecting-ip': '1.2.3.4', 'fly-client-ip': '104.16.0.1' }),
    ).toBe('104.16.0.1');
  });

  it('never trusts spoofable forwarded headers in production', async () => {
    expect(await ipFor(guarded, { 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' })).toBe(
      'unknown',
    );
  });

  it('falls back to forwarded headers outside production', async () => {
    const dev = { originGuardActive: false, production: false };
    expect(await ipFor(dev, { 'x-real-ip': '198.51.100.10', 'x-forwarded-for': '1.1.1.1' })).toBe(
      '198.51.100.10',
    );
    expect(await ipFor(dev, { 'x-forwarded-for': '198.51.100.11, 203.0.113.5' })).toBe(
      '198.51.100.11',
    );
    expect(await ipFor(dev, {})).toBe('unknown');
  });
});
