import { normalizeEmail } from '../auth/validation';

export function buildAuthVerifyHref(email: string) {
  return `/(auth)/verify?email=${encodeURIComponent(normalizeEmail(email))}`;
}

export function resolveAuthVerifyEmailParam(input: string | string[] | undefined) {
  if (typeof input === 'string') {
    const normalized = normalizeEmail(input);
    return normalized || null;
  }

  if (Array.isArray(input)) {
    const first = input.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (!first) {
      return null;
    }

    const normalized = normalizeEmail(first);
    return normalized || null;
  }

  return null;
}
