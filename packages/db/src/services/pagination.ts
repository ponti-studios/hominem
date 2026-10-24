import { ValidationError } from '../errors';

// Keyset paging for list routes. Every page is ordered by the route's established sort columns
// plus `id` as the tiebreaker, and the opaque cursor carries the last row's sort values. The
// cursor names its route and filter so a cursor cannot be replayed against a different list or a
// different filter — that walk would silently skip or repeat rows.
export const PAGE_DEFAULT_LIMIT = 20;

export interface Page<T> {
  items: T[];
  next: string | null;
}

type CursorKeyKind = 'uuid' | 'int' | 'nullableDate' | 'timestamp';
export type CursorKey = string | number | null;
type CursorSpec<K extends readonly CursorKeyKind[]> = {
  route: string;
  filter: string;
  keys: K;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
// PostgreSQL's own `timestamptz` text form, microseconds included, so rows written in the same
// millisecond are neither skipped nor repeated between pages.
const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)$/;

function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Validated in full, not just by shape: PostgreSQL's `::timestamptz` cast would reject
// `2026-02-31 10:00:00` as a database error, so a cursor carrying one must fail validation first.
function isTimestamp(value: string): boolean {
  const match = TIMESTAMP.exec(value);
  if (!match) return false;
  return (
    isCalendarDate(match[1]!) &&
    Number(match[2]) <= 23 &&
    Number(match[3]) <= 59 &&
    Number(match[4]) <= 59
  );
}

function isKey(value: unknown, kind: CursorKeyKind): value is CursorKey {
  if (kind === 'nullableDate' && value === null) return true;
  if (kind === 'int') return typeof value === 'number' && Number.isInteger(value);
  if (typeof value !== 'string') return false;
  if (kind === 'uuid') return UUID.test(value);
  if (kind === 'nullableDate') return isCalendarDate(value);
  return isTimestamp(value);
}

export function encodePageCursor(route: string, filter: string, keys: CursorKey[]): string {
  return Buffer.from(JSON.stringify({ r: route, f: filter, k: keys }), 'utf8').toString(
    'base64url',
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Decodes a cursor this route issued for this filter, or throws the standard validation error. */
export function decodePageCursor(
  cursor: string,
  spec: CursorSpec<['nullableDate', 'nullableDate', 'uuid']>,
): [string | null, string | null, string];
export function decodePageCursor(
  cursor: string,
  spec: CursorSpec<['timestamp', 'uuid']>,
): [string, string];
export function decodePageCursor(
  cursor: string,
  spec: CursorSpec<['int', 'uuid']>,
): [number, string];
export function decodePageCursor(
  cursor: string,
  spec: CursorSpec<readonly CursorKeyKind[]>,
): CursorKey[] {
  const bad = () => new ValidationError('Invalid cursor', { cursor });
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw bad();
  }
  if (!isRecord(parsed)) throw bad();
  const { r, f, k } = parsed;
  if (r !== spec.route || f !== spec.filter || !Array.isArray(k)) throw bad();
  if (k.length !== spec.keys.length) throw bad();

  const keys: CursorKey[] = [];
  for (const [index, value] of k.entries()) {
    const kind = spec.keys[index];
    if (!kind || !isKey(value, kind)) throw bad();
    keys.push(value);
  }
  return keys;
}

/** Splits an over-fetched keyset result into the page and the cursor for the rest. */
export function toPage<T>(rows: T[], limit: number, cursorOf: (last: T) => string): Page<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, next: rows.length > limit && last ? cursorOf(last) : null };
}
