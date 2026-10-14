import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { betterAuthServer } from '../auth/better-auth';
import { env } from '../env';
import { oauthDiscoveryRoutes, createMcpRoutes } from './routes';

describe('MCP discovery routes', () => {
  it('returns protected resource metadata at the base discovery path', async () => {
    const app = new Hono().route('/', oauthDiscoveryRoutes);
    const response = await app.request('/.well-known/oauth-protected-resource');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      resource: expect.stringContaining('/api/mcp'),
      authorization_servers: [expect.stringContaining('/api/auth')],
      bearer_methods_supported: ['header'],
      scopes_supported: expect.arrayContaining(['career:read']),
    });
  });

  it('serves the configured OpenAI Apps challenge', async () => {
    const { oauthDiscoveryRoutes: routes } = createMcpRoutes({
      env: { ...env, OPENAI_APPS_CHALLENGE: 'test-challenge' },
      auth: betterAuthServer,
    });
    const app = new Hono().route('/', routes);
    const response = await app.request('/.well-known/openai-apps-challenge');

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe('test-challenge');
  });
});
