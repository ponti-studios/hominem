export const AUTH_CONFIG = {
  allowedRedirectPrefixes: [
    '/account',
    '/onboarding',
    '/applications',
    '/resume',
    '/work',
    '/skills',
    '/stats',
    '/projects',
    '/testimonials',
  ],
  defaultRedirect: '/work',
} as const;
