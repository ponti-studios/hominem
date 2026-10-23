import { describe, expect, it } from 'vitest';

import { env } from './env';
import { createServer } from './server';

describe('api docs gating', () => {
  it('serves /docs outside production', async () => {
    const app = createServer({ env: { ...env, NODE_ENV: 'test' } });
    expect((await app.request('/docs')).status).toBe(200);
  });

  it('hides /docs and the Better Auth reference page in production', async () => {
    const app = createServer({ env: { ...env, NODE_ENV: 'production' } });
    expect((await app.request('/docs')).status).toBe(404);
    expect((await app.request('/api/auth/reference')).status).toBe(404);
  });
});
