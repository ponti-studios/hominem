import { afterEach, describe, expect, it, vi } from 'vitest';

import { getServerAuth, resolveSafeAuthRedirect } from './server';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('resolveSafeAuthRedirect', () => {
  it('returns fallback for empty or external targets', () => {
    expect(resolveSafeAuthRedirect('', '/finance', ['/finance'])).toBe('/finance');
    expect(resolveSafeAuthRedirect('https://evil.example', '/finance', ['/finance'])).toBe(
      '/finance',
    );
    expect(resolveSafeAuthRedirect('//evil.example', '/finance', ['/finance'])).toBe('/finance');
  });

  it('allows only configured in-app prefixes', () => {
    expect(
      resolveSafeAuthRedirect('/finance/accounts?tab=all', '/finance', ['/finance', '/accounts']),
    ).toBe('/finance/accounts?tab=all');
    expect(resolveSafeAuthRedirect('/accounts/123', '/finance', ['/finance', '/accounts'])).toBe(
      '/accounts/123',
    );
    expect(resolveSafeAuthRedirect('/admin', '/finance', ['/finance', '/accounts'])).toBe(
      '/finance',
    );
  });
});

describe('getServerAuth', () => {
  it('forwards only cookies to the session endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ isAuthenticated: false, user: null }), {
        status: 401,
      }),
    );

    await getServerAuth(
      new Request('http://localhost/test', {
        headers: {
          cookie: 'better-auth.session_token=session-cookie',
          authorization: 'Bearer legacy-token',
        },
      }),
      { apiBaseUrl: 'http://localhost:4040' },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] ?? [];
    const headers = init?.headers as Headers;
    expect(headers.get('cookie')).toBe('better-auth.session_token=session-cookie');
    expect(headers.has('authorization')).toBe(false);
  });
});
