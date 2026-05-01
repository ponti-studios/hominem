/**
 * Mobile app auth routing configuration.
 *
 * Defines canonical post-auth destinations and allowed redirect paths for the mobile app.
 */

type AppAuthConfig = {
  /** Platform-specific canonical post-auth destination path. */
  defaultPostAuthDestination: string;
  /** Allowed redirect prefixes for safe redirect validation. */
  allowedDestinations: string[];
};

export const CHAT_AUTH_CONFIG: AppAuthConfig = {
  defaultPostAuthDestination: '/(protected)/(tabs)/',
  allowedDestinations: ['/(protected)/(tabs)/'],
};
