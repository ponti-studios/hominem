const { passkeyClient } = require('@better-auth/passkey/client') as {
  passkeyClient: (...args: any[]) => any;
};
const { createAuthClient } = require('better-auth/react') as {
  createAuthClient: (...args: any[]) => any;
};
const { emailOTPClient } = require('better-auth/client/plugins') as {
  emailOTPClient: (...args: any[]) => any;
};

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
