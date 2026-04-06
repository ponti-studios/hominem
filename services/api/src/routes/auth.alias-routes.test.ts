import { Hono } from 'hono';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handler: vi.fn(),
}));

vi.mock('../auth/better-auth', () => ({
  betterAuthServer: {
    handler: mocks.handler,
  },
}));

import { authRoutes } from './auth';

function createApp() {
  return new Hono().route('/api/auth', authRoutes);
}

describe('auth alias routes', () => {
  beforeEach(() => {
    mocks.handler.mockReset();
  });

  test('email otp send aliases to Better Auth and preserves cookies', async () => {
    mocks.handler.mockImplementation(async (request: Request) => {
      expect(request.method).toBe('POST');
      expect(new URL(request.url).pathname).toBe('/api/auth/email-otp/send-verification-otp');
      await expect(request.json()).resolves.toEqual({
        email: 'alias@hominem.test',
        type: 'sign-in',
      });

      const headers = new Headers();
      headers.append('set-cookie', 'better-auth.session=abc; Path=/; HttpOnly');

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers,
      });
    });

    const response = await createApp().request('http://localhost/api/auth/email-otp/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'alias@hominem.test',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('better-auth.session=abc');
  });

  test('session and logout aliases forward to stable auth endpoints', async () => {
    mocks.handler
      .mockImplementationOnce(async (request: Request) => {
        expect(request.method).toBe('GET');
        expect(new URL(request.url).pathname).toBe('/api/auth/get-session');
        return new Response(JSON.stringify({ user: null, session: null }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      })
      .mockImplementationOnce(async (request: Request) => {
        expect(request.method).toBe('POST');
        expect(new URL(request.url).pathname).toBe('/api/auth/sign-out');
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
          },
        });
      });

    const app = createApp();
    const sessionResponse = await app.request('http://localhost/api/auth/session');
    const logoutResponse = await app.request('http://localhost/api/auth/logout', {
      method: 'POST',
    });

    expect(sessionResponse.status).toBe(200);
    expect(logoutResponse.status).toBe(200);
    expect(mocks.handler).toHaveBeenCalledTimes(2);
  });

  test('passkey aliases map option, verify, list, and delete routes', async () => {
    const requests: Array<{ method: string; url: string; body: string }> = [];

    mocks.handler.mockImplementation(async (request: Request) => {
      const body =
        request.method === 'GET' || request.method === 'HEAD' ? '' : await request.text();
      requests.push({
        method: request.method,
        url: request.url,
        body,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
        },
      });
    });

    const app = createApp();

    await app.request('http://localhost/api/auth/passkeys');
    await app.request('http://localhost/api/auth/passkey/auth/options', {
      method: 'POST',
    });
    await app.request('http://localhost/api/auth/passkey/auth/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        response: {
          id: 'auth-response',
        },
      }),
    });
    await app.request('http://localhost/api/auth/passkey/register/options', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'MacBook',
        authenticatorAttachment: 'platform',
      }),
    });
    await app.request('http://localhost/api/auth/passkey/register/verify', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        response: {
          id: 'register-response',
        },
      }),
    });
    await app.request('http://localhost/api/auth/passkey/delete', {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: 'passkey-123',
      }),
    });

    expect(requests).toEqual([
      {
        method: 'GET',
        url: expect.stringContaining('/api/auth/passkey/list-user-passkeys'),
        body: '',
      },
      {
        method: 'GET',
        url: expect.stringContaining('/api/auth/passkey/generate-authenticate-options'),
        body: '',
      },
      {
        method: 'POST',
        url: expect.stringContaining('/api/auth/passkey/verify-authentication'),
        body: JSON.stringify({
          response: {
            id: 'auth-response',
          },
        }),
      },
      {
        method: 'GET',
        url: expect.stringContaining(
          '/api/auth/passkey/generate-register-options?name=MacBook&authenticatorAttachment=platform',
        ),
        body: '',
      },
      {
        method: 'POST',
        url: expect.stringContaining('/api/auth/passkey/verify-registration'),
        body: JSON.stringify({
          response: {
            id: 'register-response',
          },
        }),
      },
      {
        method: 'POST',
        url: expect.stringContaining('/api/auth/passkey/delete-passkey'),
        body: JSON.stringify({
          id: 'passkey-123',
        }),
      },
    ]);
  });
});
