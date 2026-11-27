import { z } from 'zod';

import { GoogleAuthError } from './google.js';
import { HominemAuthError } from './hominem-auth.js';
import { HominemMcpError } from './hominem.js';
import { WealthProviderError } from './wealth-providers.js';
import { WealthError } from './wealth.js';

// Fixed text for Google auth failures. The message names the command that fixes each one.
const GOOGLE_FAILURES: Record<GoogleAuthError['code'], string> = {
  TOKEN_MISSING: 'hominem: no Google token or client secret found. Run `hominem auth google`.',
  TOKEN_REVOKED: 'hominem: Google revoked the token. Run `hominem auth google`.',
  REFRESH_FAILED: 'hominem: could not refresh the Google token. Run `hominem auth google`.',
  API_UNAUTHORIZED: 'hominem: Google rejected the token. Run `hominem auth google`.',
  API_FAILED: 'hominem: the Google API call failed. Try again later.',
  NETWORK: 'hominem: could not reach Google. Check your connection.',
};

// Codes Node and Bun use when a socket never connects or a host never resolves.
const NETWORK_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

function codeOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('code' in value)) return undefined;
  return typeof value.code === 'string' ? value.code : undefined;
}

/** True when the request never reached a server: a refused, unresolved or reset connection. */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = 'cause' in error ? error.cause : undefined;
  return NETWORK_CODES.has(codeOf(error) ?? '') || NETWORK_CODES.has(codeOf(cause) ?? '');
}

/**
 * The one-line message a user sees for a failed command. Known errors keep their own message;
 * anything else gets a fixed line so no raw stack or unexpected text reaches the terminal.
 */
export function describeError(error: unknown): string {
  if (error instanceof GoogleAuthError) return GOOGLE_FAILURES[error.code];
  if (
    error instanceof WealthError ||
    error instanceof WealthProviderError ||
    error instanceof HominemMcpError ||
    error instanceof HominemAuthError
  ) {
    return error.message;
  }
  if (error instanceof z.ZodError) {
    const where = error.issues[0]?.path.join('.') || 'root';
    return `hominem: the server sent data in an unexpected shape (at ${where}). Try again, or report it if it keeps happening.`;
  }
  if (isNetworkError(error)) {
    return 'hominem: could not reach the server. Check your connection, or run `hominem auth` in a terminal to set the API URL.';
  }
  return 'hominem: unexpected error. Run again with HOMINEM_DEBUG=1 to see the details.';
}
