import { authClient } from '~/services/auth/auth-client';

export async function probeAuthSession(input: {
  sessionCookieHeader: string | null;
  signal: AbortSignal;
}) {
  const result = await authClient.getSession({
    fetchOptions: {
      signal: input.signal,
      headers: input.sessionCookieHeader ? { cookie: input.sessionCookieHeader } : undefined,
    },
  });

  if (result.data?.user && result.data.session?.id) {
    return { user: result.data.user };
  }

  if (result.error?.status === 401) {
    return null;
  }

  throw new Error(result.error?.message ?? 'session probe failed');
}
