import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const authClientCache = new Map<string, ReturnType<typeof createBrowserAuthClient>>();

function createBrowserAuthClient(apiBaseUrl: string) {
  return createAuthClient({
    baseURL: apiBaseUrl,
    plugins: [emailOTPClient(), passkeyClient()],
  });
}

export function getAuthClient(apiBaseUrl: string) {
  let client = authClientCache.get(apiBaseUrl);
  if (!client) {
    client = createBrowserAuthClient(apiBaseUrl);
    authClientCache.set(apiBaseUrl, client);
  }
  return client;
}
