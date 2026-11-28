/** Narrowing for the untyped JSON that CLIs and HTTP APIs hand back, so nobody has to cast it. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

/** A list field that may be absent. Anything else that isn't an array is a broken payload. */
export function list(value: unknown): unknown[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError('expected an array in the response');
  return value;
}

/** `list`, with every entry readable as an object (junk entries read as empty). */
export function records(value: unknown): Record<string, unknown>[] {
  return list(value).map((entry) => asRecord(entry) ?? {});
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
