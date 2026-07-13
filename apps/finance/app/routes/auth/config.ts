import { serverEnv } from '~/lib/env';

export const AUTH_CONFIG = {
  allowedRedirectPrefixes: [
    '/finance',
    '/import',
    '/accounts',
    '/analytics',
    '/account',
    '/settings',
  ],
  defaultRedirect: '/finance',
} as const;

export const AUTH_SERVER_ROUTE_CONFIG = {
  ...AUTH_CONFIG,
  getApiBaseUrl: () => serverEnv.VITE_AUTH_API_URL ?? serverEnv.VITE_PUBLIC_API_URL,
} as const;
