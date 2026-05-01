/**
 * Canonical cross-platform auth routing contract.
 *
 * Keep protocol and redirect policy here. User-facing auth copy belongs to
 * @hominem/ui because presentation and translation are UI concerns.
 */

/** Must match AUTH_EMAIL_OTP_EXPIRES_SECONDS on the server (default 300). */
export const OTP_EXPIRES_SECONDS = 300;

type AppAuthConfig = {
  /** Platform-specific canonical post-auth destination path. */
  defaultPostAuthDestination: string;
  /** Allowed redirect prefixes for safe redirect validation (web only). */
  allowedDestinations: string[];
};

/** Web app auth config. */
export const NOTES_AUTH_CONFIG: AppAuthConfig = {
  defaultPostAuthDestination: '/notes',
  allowedDestinations: ['/', '/home', '/chat', '/notes', '/account', '/settings'],
};

/** Mobile app auth config. */
export const CHAT_AUTH_CONFIG: AppAuthConfig = {
  defaultPostAuthDestination: '/(protected)/(tabs)/',
  allowedDestinations: ['/(protected)/(tabs)/'],
};
