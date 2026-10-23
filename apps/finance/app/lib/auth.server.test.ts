// @vitest-environment node

import { expect, it, vi } from 'vitest';

vi.mock('./env.server', () => ({
  serverEnv: {
    HOMINEM_INTERNAL_API_URL: 'http://hominem-api.internal:4040',
    VITE_PUBLIC_API_URL: 'http://localhost:3000',
  },
}));

import { getServerAuth } from './auth.server';

it('uses the server-only API URL for session checks', async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => Response.json(null));
  vi.stubGlobal('fetch', fetchMock);

  await getServerAuth(new Request('http://localhost/account'));

  expect(fetchMock.mock.calls[0]?.[0]).toBe(
    'http://hominem-api.internal:4040/api/auth/get-session',
  );
  vi.unstubAllGlobals();
});
