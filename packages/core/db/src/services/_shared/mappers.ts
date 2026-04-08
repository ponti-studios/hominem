/**
 * Shared mapping helpers used across repositories.
 * Eliminates the 4+ duplicate toIsoString implementations.
 */

export function toIsoString(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export function toRequiredIsoString(value: Date | string | null | undefined): string {
  return toIsoString(value) ?? new Date().toISOString();
}
