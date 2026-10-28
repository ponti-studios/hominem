import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { betterAuthServer } from './auth/better-auth';
import { createServer } from './server';
import { createTestEnv } from './testkit/server';

describe('Telegram webhook route', () => {
  beforeEach(() => {
    vi.spyOn(betterAuthServer.api, 'getSession').mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses the Telegram secret check instead of the Telegram RPC session auth', async () => {
    const app = createServer({
      env: createTestEnv({
        TELEGRAM_BOT_TOKEN: 'bot-token',
        TELEGRAM_WEBHOOK_SECRET: 'webhook-secret',
      }),
      auth: betterAuthServer,
    });

    const response = await app.request('/api/telegram/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Telegram-Bot-Api-Secret-Token': 'wrong-secret',
      },
      body: '{}',
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });
});
