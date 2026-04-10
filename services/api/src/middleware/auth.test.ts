import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock('../auth/better-auth', () => ({
  betterAuthServer: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

import { authJwtMiddleware } from './auth';

function createApp() {
  return new Hono().use('*', authJwtMiddleware()).get('/protected', (c) => {
    return c.json({
      userId: c.get('userId') ?? null,
      auth: c.get('auth') ?? null,
    });
  });
}

describe('authJwtMiddleware', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
  });

  test('hydrates auth context from Better Auth sessions', async () => {
    mocks.getSession.mockResolvedValueOnce({
      user: {
        id: 'better-user',
        email: 'better@hominem.test',
        name: 'Better User',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      },
      session: {
        id: 'better-session',
      },
    });

    const app = createApp();
    const response = await app.request('http://localhost/protected', {
      headers: {
        authorization: 'Bearer better-auth-token',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: 'better-user',
      auth: {
        sid: 'better-session',
        amr: ['better-auth-session'],
      },
    });
  });

  test('leaves the context empty when no Better Auth session exists', async () => {
    mocks.getSession.mockResolvedValueOnce(null);

    const app = createApp();
    const response = await app.request('http://localhost/protected', {
      headers: {},
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: null,
      auth: null,
    });
  });

  test('ignores unrelated request headers when no session exists', async () => {
    mocks.getSession.mockResolvedValueOnce(null);

    const app = createApp();
    const response = await app.request('http://localhost/protected', {
      headers: {
        authorization: 'Bearer invalid-token',
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: null,
      auth: null,
    });
  });
});
