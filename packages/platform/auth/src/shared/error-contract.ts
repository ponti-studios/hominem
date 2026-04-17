import { resolveAuthRedirect } from './redirect-policy';

type AuthCallbackErrorRedirectOptions = {
  next: string | null | undefined;
  fallback: string;
  allowedPrefixes?: string[];
  description?: string;
  code?: string;
};

export function buildAuthCallbackErrorRedirect({
  next,
  fallback,
  allowedPrefixes = [fallback],
  description,
  code,
}: AuthCallbackErrorRedirectOptions): string {
  const { safeRedirect } = resolveAuthRedirect(next, fallback, allowedPrefixes);
  const url = new URL(safeRedirect, 'http://localhost');
  if (code) url.searchParams.set('error', code);
  if (description) url.searchParams.set('description', description);
  return `${url.pathname}${url.search}${url.hash}`;
}

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
