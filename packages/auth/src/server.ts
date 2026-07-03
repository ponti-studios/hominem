import type { Session, User } from './types';

interface AuthConfig {
  apiBaseUrl: string;
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
      return {
        user: testUser,
        session: {
          id: 'test-session',
          token: 'test-session',
          userId: testUser.id,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          ipAddress: null,
          userAgent: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } satisfies Session,
        headers: new Headers(),
      };
    }
  }

  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(
    new URL('/api/auth/get-session', config.apiBaseUrl).toString(),
    { method: 'GET', headers },
  );

  if (!response.ok) {
    return { user: null, session: null, headers: new Headers() };
  }

  const payload = (await response.json()) as { user: User; session: Session } | null;
  return {
    user: payload?.user ?? null,
    session: payload?.session ?? null,
    headers: new Headers(),
  };
}
