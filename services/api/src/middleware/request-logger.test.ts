import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from './request-logger';

describe('requestLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not emit routine start or completion logs', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = new Hono();
    app.use('*', requestLogger());
    app.get('/api/credentials/:deviceId', (c) => c.text('ok'));

    const response = await app.request('/api/credentials/device-1');

    expect(response.status).toBe(200);
    expect(info).not.toHaveBeenCalled();
  });

  it('logs the route template, status and duration when LOG_REQUESTS is on', async () => {
    vi.stubEnv('LOG_REQUESTS', 'true');
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = new Hono();
    app.use('*', requestLogger());
    app.post('/api/possessions/:id/images', (c) => c.text('nope', 404));

    await app.request('/api/possessions/abc-123/images?token=secret', { method: 'POST' });

    expect(info).toHaveBeenCalledTimes(1);
    const call = info.mock.calls[0];
    expect(call?.[0]).toBe('http_request');
    const fields = call?.[1];
    expect(fields).toMatchObject({
      method: 'POST',
      route: '/api/possessions/:id/images',
      statusCode: 404,
    });
    expect(JSON.stringify(fields)).not.toContain('secret');
  });
});
