import type { JsonValue } from '@hominem/db/types';

export function jsonStringArray(value: JsonValue | null | undefined): string[] {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}
