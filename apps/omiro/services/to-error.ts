/** Normalizes anything thrown or rejected into an `Error` for the logger. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
