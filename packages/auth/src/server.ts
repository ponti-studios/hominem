import type { User } from './types';

interface AuthConfig {
  apiBaseUrl: string;
}

interface SessionPayload {
  isAuthenticated: boolean;
  user: User | null;
}

function getTestAuthUser(cookieHeader: string | null): User | null {
  const testAuthCookie = cookieHeader
    ?.split(';')
    .find((cookie) => cookie.trim().startsWith('test-auth-user='))
    ?.split('=')[1];
  if (!testAuthCookie) return null;
  try {
    return JSON.parse(decodeURIComponent(testAuthCookie)) as User;
  } catch {
    return null;
  }
}

export async function getServerAuth(request: Request, config: AuthConfig) {
  const headers = new Headers();
  const cookie = request.headers.get('cookie');

  if (process.env.NODE_ENV !== 'production') {
    const testUser = getTestAuthUser(cookie);
    if (testUser) {
      return { user: testUser, headers: new Headers() };
    }
  }

  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(new URL('/api/auth/session', config.apiBaseUrl).toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return { user: null, headers: new Headers() };
  }

  const payload = (await response.json()) as SessionPayload | null;
  return {
    user: payload?.isAuthenticated ? (payload.user ?? null) : null,
    headers: new Headers(),
  };
}
