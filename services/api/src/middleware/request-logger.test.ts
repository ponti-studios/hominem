import { logger } from '@hominem/telemetry';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestLogger } from './request-logger';

describe('requestLogger', () => {
  afterEach(() => vi.restoreAllMocks());

  it('does not emit routine start or completion logs', async () => {
    const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
    const app = new Hono();
    app.use('*', requestLogger());
    app.get('/api/credentials/:deviceId', (c) => c.text('ok'));

    const response = await app.request('/api/credentials/device-1');

    expect(response.status).toBe(200);
    expect(info).not.toHaveBeenCalled();
  });
});
