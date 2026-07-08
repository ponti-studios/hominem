import { createAuthPasskeyCallbackRoute } from '~/lib/auth-server-routes';

import { AUTH_CONFIG } from './config';

const authPasskeyCallbackRoute = createAuthPasskeyCallbackRoute({
  allowedRedirectPrefixes: [...AUTH_CONFIG.allowedRedirectPrefixes],
  defaultRedirect: AUTH_CONFIG.defaultRedirect,
});

export const action = authPasskeyCallbackRoute.action;
