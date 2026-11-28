// A throwaway env file and a fake Hominem API for the `hominem auth` setup cases.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { test, vi } from 'vitest';

export const authSetupTest = test.extend<{ envFile: string }>({
  envFile: async ({ task: _task }, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'hominem-auth-setup-test-'));
    // Stubbing records the original, so cleanup restores it whatever the case does to it.
    vi.stubEnv('HOMINEM_API_URL', undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await use(join(dir, 'env'));
    } finally {
      vi.unstubAllEnvs();
      vi.restoreAllMocks();
      await rm(dir, { recursive: true, force: true });
    }
  },
});

/** Only `origin` is up. Discovery works there; sign-in stops at client registration. */
export function fakeHominemApi(origin: string) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = new URL(input.toString());
    if (url.origin !== origin) {
      throw Object.assign(new TypeError('fetch failed'), { code: 'ECONNREFUSED' });
    }
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      return Response.json({
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
      });
    }
    return new Response(null, { status: 503 });
  });
}
