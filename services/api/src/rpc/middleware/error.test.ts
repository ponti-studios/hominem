import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from './auth';
import { apiErrorHandler } from './error';

describe('apiErrorHandler', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs the matched route template and retains the exception for the platform logs', async () => {
    const errorOutput = vi.spyOn(console, 'error').mockImplementation(() => {});
    const app = new Hono<AppContext>().onError(apiErrorHandler);
    app.get('/api/credentials/:deviceId', () => {
      throw new Error('diagnostic details');
    });

    await app.request('/api/credentials/device-1');

    const log = String(errorOutput.mock.calls[0]?.[0]);
    expect(log).toContain('"path":"/api/credentials/:deviceId"');
    expect(log).toContain('"error_message":"diagnostic details"');
    expect(log).not.toContain('device-1');
  });
});
