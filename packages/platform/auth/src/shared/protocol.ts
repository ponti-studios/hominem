/**
 * Auth protocol constants and types.
 *
 * Owns protocol-level concerns only: token expiry, session constraints, etc.
 * App-specific routing belongs in each app.
 */

/** Must match AUTH_EMAIL_OTP_EXPIRES_SECONDS on the server (default 300). */
export const OTP_EXPIRES_SECONDS = 300;
