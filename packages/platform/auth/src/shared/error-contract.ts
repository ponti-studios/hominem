/**
 * Auth callback error contract.
 *
 * Helpers for encoding auth errors into redirect URLs and reading them back.
 * Used by web app routes to propagate error context through the redirect chain.
 */

import { resolveAuthRedirect } from './redirect-policy';

// ─── Error URL Builder ────────────────────────────────────────────────────────

export interface AuthCallbackErrorRedirectOptions {
  next: string | null | undefined;
  fallback: string;
  allowedPrefixes?: string[];
  description?: string;
  code?: string;
}

/**
 * Builds a safe redirect URL with auth error query params appended.
 * The destination path is validated against `allowedPrefixes` before use.
 */
export function buildAuthCallbackErrorRedirect({
  next,
  fallback,
  allowedPrefixes = [fallback],
  description,
  code,
}: AuthCallbackErrorRedirectOptions): string {
  const { safeRedirect } = resolveAuthRedirect(next, fallback, allowedPrefixes);
  const url = new URL(safeRedirect, 'https://hominem.local');
  if (code) url.searchParams.set('error', code);
  if (description) url.searchParams.set('description', description);
  return `${url.pathname}${url.search}${url.hash}`;
}

// ─── Error URL Reader ─────────────────────────────────────────────────────────

/**
 * Reads a human-readable error message from URLSearchParams produced by
 * `buildAuthCallbackErrorRedirect`.
 */
export function readAuthErrorMessage(params: URLSearchParams): string | null {
  const description = params.get('description') ?? params.get('error_description');
  if (description) return description;
  const code = params.get('error');
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? code;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'Access was denied.',
  invalid_request: 'The request was invalid.',
  server_error: 'A server error occurred. Please try again.',
  temporarily_unavailable: 'The service is temporarily unavailable. Please try again.',
};
