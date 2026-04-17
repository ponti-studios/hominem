import type { Session, User } from '@hominem/auth/types';

import { serverEnv } from './env.server';

export const authConfig = {
  apiBaseUrl: serverEnv.VITE_PUBLIC_API_URL,
};

export async function getServerSession(request: Request) {
  const headers = new Headers();
  const cookie = request.headers.get('cookie');
  if (cookie) {
    headers.set('cookie', cookie);
  }

  const response = await fetch(new URL('/api/auth/get-session', authConfig.apiBaseUrl).toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return { user: null, session: null, headers: new Headers() };
  }

  const payload = (await response.json()) as {
    user: User;
    session: Session;
  } | null;

  return {
    user: payload?.user ?? null,
    session: payload?.session ?? null,
    headers: new Headers(),
  };
}
