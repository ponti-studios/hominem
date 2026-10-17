import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from './request-logger';

describe('requestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('logs a route template instead of short dynamic path identifiers', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = new Hono();
    app.use('*', requestLogger());
    app.get('/api/credentials/:deviceId', (c) => c.text('ok'));

    await app.request('/api/credentials/device-1');

    const requestLogs = info.mock.calls.map(([event, fields]) => ({ event, fields }));
    expect(requestLogs).toHaveLength(2);
    expect(requestLogs[1]?.fields?.path).toBe('/api/credentials/:deviceId');
    expect(JSON.stringify(requestLogs)).not.toContain('device-1');
  });
});
