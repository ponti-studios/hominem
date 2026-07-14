import { normalizeOtp } from '@hominem/utils';

export { normalizeOtp } from '@hominem/utils';

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  const atIndex = normalized.indexOf('@');
  const domain = normalized.slice(atIndex + 1);
  return (
    atIndex > 0 &&
    atIndex === normalized.lastIndexOf('@') &&
    atIndex < normalized.length - 1 &&
    !/\s/.test(normalized) &&
    domain.includes('.')
  );
}

export function isValidOtp(value: string): boolean {
  const normalized = normalizeOtp(value);
  return /^[0-9]{6}$/.test(normalized);
}
