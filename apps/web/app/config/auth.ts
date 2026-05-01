/**
 * Web app auth routing configuration.
 *
 * Defines canonical post-auth destinations and allowed redirect paths for the web app.
 */

type AppAuthConfig = {
  /** Platform-specific canonical post-auth destination path. */
  defaultPostAuthDestination: string;
  /** Allowed redirect prefixes for safe redirect validation (web only). */
  allowedDestinations: string[];
};

export const NOTES_AUTH_CONFIG: AppAuthConfig = {
  defaultPostAuthDestination: '/notes',
  allowedDestinations: ['/', '/home', '/chat', '/notes', '/account', '/settings'],
};
