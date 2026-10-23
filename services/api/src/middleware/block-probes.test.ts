import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { blockMaliciousProbes } from './block-probes';

const app = new Hono().use('*', blockMaliciousProbes()).all('*', (c) => c.text('ok'));

describe('blockMaliciousProbes', () => {
  it.each([
    '/.git/HEAD',
    '/.git/config',
    '/.env',
    '/.env.production',
    '/actuator/health',
    '/server-status',
    '/.aws/credentials',
    '/wp-login.php',
  ])('404s %s', async (path) => {
    expect((await app.request(path)).status).toBe(404);
  });

  it.each(['/', '/login', '/api/status', '/.well-known/oauth-authorization-server'])(
    'lets %s through',
    async (path) => {
      expect((await app.request(path)).status).toBe(200);
    },
  );
});
