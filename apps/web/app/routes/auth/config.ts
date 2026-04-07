import { AUTH_COPY, NOTES_AUTH_CONFIG } from '@hominem/auth';

export const AUTH_CONFIG = {
  allowedRedirectPrefixes: NOTES_AUTH_CONFIG.allowedDestinations,
  defaultRedirect: NOTES_AUTH_CONFIG.defaultPostAuthDestination,
  title: AUTH_COPY.emailEntry.title,
} as const;
