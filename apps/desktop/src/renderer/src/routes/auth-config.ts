import { AUTH_COPY, NOTES_AUTH_CONFIG } from '@hominem/auth';

import { desktopEnv } from '@/lib/env';

export const AUTH_CONFIG = {
  allowedRedirectPrefixes: NOTES_AUTH_CONFIG.allowedDestinations,
  defaultRedirect: '/app-shell',
  title: AUTH_COPY.emailEntry.title,
} as const;

export function getAuthApiBaseUrl() {
  return desktopEnv.VITE_PUBLIC_API_URL;
}
