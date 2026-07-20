import { Hono } from 'hono';

import { env } from '../env';

/**
 * Serves the AASA file iOS fetches to verify Omiro's passkey (webcredentials)
 * association with AUTH_PASSKEY_RP_ID before it will trust the app's
 * associated-domains entitlement for native passkey ceremonies.
 * Mounted at the server root (see server.ts) — Apple requires this exact
 * unauthenticated path with no redirect.
 */
export const appleAppSiteAssociationRoutes = new Hono().get(
  '/.well-known/apple-app-site-association',
  (c) => {
    const apps = env.AUTH_PASSKEY_APPLE_APP_IDS.split(',')
      .map((app) => app.trim())
      .filter(Boolean);

    return c.json({ webcredentials: { apps } });
  },
);
