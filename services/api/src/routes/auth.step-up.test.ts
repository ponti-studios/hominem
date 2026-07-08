import { STEP_UP_ACTIONS } from '@hominem/auth/step-up-actions';
import { authDb } from '@hominem/db';
import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cleanupAuthState } from '../test/setup/auth-state.cleanup';

const proofStore = vi.hoisted(() => new Map<string, string>());
const STEP_UP_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const FIRST_TIME_USER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

vi.mock('@hominem/services/redis', () => ({
  redis: {
    on: vi.fn(),
    set: vi.fn(async (key: string, value: string) => {
      proofStore.set(key, value);
      return 'OK';
    }),
    get: vi.fn(async (key: string) => proofStore.get(key) ?? null),
  },
}));

import { authRoutes } from './auth';

function createAuthedAppForUser(userId: string) {
  return new Hono<{
    Variables: {
      userId?: string;
    };
  }>()
    .use('*', async (c, next) => {
      c.set('userId', userId);
      await next();
    })
    .route('/api/auth', authRoutes);
}

describe('auth step-up enforcement', () => {
  beforeEach(async () => {
    proofStore.clear();
    await cleanupAuthState();

    await authDb
      .insertInto('user')
      .values([
        {
          id: STEP_UP_USER_ID,
          email: 'step-up-existing@hominem.test',
          name: 'Existing Passkey User',
          emailVerified: false,
        },
        {
          id: FIRST_TIME_USER_ID,
          email: 'step-up-first-time@hominem.test',
          name: 'First Time Passkey User',
          emailVerified: false,
        },
      ])
      .execute();

    await authDb
      .insertInto('passkey')
      .values({
        id: 'step-up-passkey',
        userId: STEP_UP_USER_ID,
        name: 'Existing Device',
        publicKey: 'public-key',
        credentialID: 'credential-id',
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        transports: 'internal',
        aaguid: 'test-aaguid',
      })
      .execute();
  });

  test('blocks passkey registration options without recent step-up proof', async () => {
    const app = createAuthedAppForUser(STEP_UP_USER_ID);

    const response = await app.request(
      'http://localhost/api/auth/passkey/generate-register-options',
      { method: 'GET' },
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'step_up_required',
      action: STEP_UP_ACTIONS.PASSKEY_REGISTER,
    });
  });

  test('allows first passkey registration to proceed without step-up proof', async () => {
    const app = createAuthedAppForUser(FIRST_TIME_USER_ID);

    const response = await app.request(
      'http://localhost/api/auth/passkey/generate-register-options',
      { method: 'GET' },
    );

    // Forwarded to Better Auth (not 403). Exact status depends on BA session/options.
    expect(response.status).not.toBe(403);
  });

  test('blocks passkey deletion without recent step-up proof', async () => {
    const app = createAuthedAppForUser(STEP_UP_USER_ID);

    const response = await app.request('http://localhost/api/auth/passkey/delete-passkey', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id: 'passkey-1' }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'step_up_required',
      action: STEP_UP_ACTIONS.PASSKEY_DELETE,
    });
  });

  test('blocks native BA registration verify path without step-up when enrolled', async () => {
    const app = createAuthedAppForUser(STEP_UP_USER_ID);

    const response = await app.request('http://localhost/api/auth/passkey/verify-registration', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: {} }),
    });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: 'step_up_required',
      action: STEP_UP_ACTIONS.PASSKEY_REGISTER,
    });
  });
});
