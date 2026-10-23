import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { betterAuthServer } from './auth/better-auth';
import { createServer } from './server';
import { createTestEnv } from './testkit/server';

function createApp() {
  const app = createServer({ env: createTestEnv(), auth: betterAuthServer });
  app.get('/test-large-json', (c) =>
    c.json({
      items: Array.from({ length: 200 }, (_, index) => ({ id: index, name: `item-${index}` })),
    }),
  );
  return app;
}

describe('api response pipeline', () => {
  beforeEach(() => {
    vi.spyOn(betterAuthServer.api, 'getSession').mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns minified JSON', async () => {
    const response = await createApp().request('/');
    const text = await response.text();

    expect(text).not.toContain('\n');
    expect(text).not.toContain('  ');
  });

  it('gzip-compresses a large JSON response when the client accepts gzip', async () => {
    const response = await createApp().request('/test-large-json', {
      headers: { 'accept-encoding': 'gzip' },
    });

    expect(response.headers.get('content-encoding')).toBe('gzip');
    expect(response.headers.get('vary')).toContain('Accept-Encoding');
  });

  it('leaves a response uncompressed when the client does not accept compression', async () => {
    const response = await createApp().request('/test-large-json');

    expect(response.headers.get('content-encoding')).toBeNull();
  });
});
