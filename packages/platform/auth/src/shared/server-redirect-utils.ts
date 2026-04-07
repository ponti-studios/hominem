import { resolveAuthRedirect } from './redirect-policy';

export function resolveSafeAuthRedirect(
  next: string | null | undefined,
  fallback: string,
  allowedPrefixes: string[] = [fallback],
) {
  return resolveAuthRedirect(next, fallback, allowedPrefixes).safeRedirect;
}
