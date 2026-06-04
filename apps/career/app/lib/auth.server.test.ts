import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAuthenticatedUser, getServerSession } from './auth.server';

const sessionPayload = {
  user: {
    id: 'auth-user-id',
    email: 'user@example.com',
    emailVerified: true,
    name: 'Test User',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  session: {
    id: 'session-id',
    token: 'token',
    userId: 'auth-user-id',
    expiresAt: new Date(),
    ipAddress: null,
    userAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
};

describe('career auth server helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reads the current session from the shared auth API', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json(sessionPayload));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getServerSession(
      new Request('http://localhost/account', {
        headers: { cookie: 'better-auth.session_token=session-token' },
      }),
    );

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    if (!(init?.headers instanceof Headers)) throw new Error('expected fetch Headers');

    expect(String(url)).toMatch(/\/api\/auth\/get-session$/);
    expect(init.method).toBe('GET');
    expect(init.headers.get('cookie')).toBe('better-auth.session_token=session-token');
    expect(result.user?.id).toBe('auth-user-id');
    expect(result.session?.id).toBe('session-id');
    expect(result.headers).toBeInstanceOf(Headers);
  });

  it('returns null auth data when the shared auth API has no session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 401 })),
    );

    await expect(getServerSession(new Request('http://localhost/'))).resolves.toEqual({
      user: null,
      session: null,
      headers: expect.any(Headers),
    });
  });

  it('uses the shared session user for getAuthenticatedUser', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(sessionPayload)),
    );

    const user = await getAuthenticatedUser(new Request('http://localhost/'));

    expect(user?.id).toBe(sessionPayload.user.id);
    expect(user?.email).toBe(sessionPayload.user.email);
  });

  it('uses the test auth cookie without calling the shared auth API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const testUser = {
      id: '00000000-0000-0000-0000-000000000000',
      email: 'test@example.com',
      name: 'Test User',
    };

    const result = await getServerSession(
      new Request('http://localhost/editor', {
        headers: { cookie: `test-auth-user=${encodeURIComponent(JSON.stringify(testUser))}` },
      }),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.user?.id).toBe(testUser.id);
    expect(result.session?.id).toBe('test-session');
  });
});
