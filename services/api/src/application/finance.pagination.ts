import { createHash } from 'crypto';

import { ValidationError } from '@hominem/db/errors';

// Keyset paging for `finance.transactions`. The wire cursor is the same opaque envelope the career
// list routes use: base64url of `{ r: route, f: filter, k: keys }`. The cursor names the route and
// filter that issued it, so a malformed cursor, a cursor from another endpoint, or one from a
// different filter is a validation error instead of a walk over a different list.
export const FINANCE_TRANSACTION_PAGE_DEFAULT_LIMIT = 20;
export const FINANCE_TRANSACTION_PAGE_MAX_LIMIT = 50;

export interface FinanceTransactionPage<T> {
  items: T[];
  next: string | null;
}

type CursorKeyKind = 'uuid' | 'date' | 'score';
export type CursorKey = string | number;
type CursorSpec = {
  route: string;
  filter: string;
  keys: readonly CursorKeyKind[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function isCalendarDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isKey(value: unknown, kind: CursorKeyKind): value is CursorKey {
  if (kind === 'score') return typeof value === 'number' && Number.isFinite(value);
  if (typeof value !== 'string') return false;
  if (kind === 'uuid') return UUID.test(value);
  return isCalendarDate(value);
}

export function encodeFinanceTransactionCursor(
  route: string,
  filter: string,
  keys: CursorKey[],
): string {
  return Buffer.from(JSON.stringify({ r: route, f: filter, k: keys }), 'utf8').toString(
    'base64url',
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Decodes a cursor this route issued for this filter, or throws the standard validation error. */
export function decodeFinanceTransactionCursor(cursor: string, spec: CursorSpec): CursorKey[] {
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
export function toFinanceTransactionPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (last: T) => string,
): FinanceTransactionPage<T> {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, next: rows.length > limit && last ? cursorOf(last) : null };
}

export interface FinanceTransactionFilterKeyInput {
  accountIds: readonly string[];
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  text?: string | undefined;
  tagIds: readonly string[];
  tagNames: readonly string[];
  categoryName?: string | undefined;
  transactionType?: string | undefined;
  amountMin?: number | undefined;
  amountMax?: number | undefined;
}

/**
 * Fingerprints every filter that changes which rows a page contains, so a cursor only resumes the
 * exact walk that issued it. Hashed rather than embedded so the cursor stays inside the request
 * schema's 512-character cap however many account and tag ids a filter carries.
 */
export function financeTransactionFilterKey(input: FinanceTransactionFilterKeyInput): string {
  const fingerprint = JSON.stringify([
    [...input.accountIds].sort(),
    input.dateFrom ?? null,
    input.dateTo ?? null,
    input.text ?? null,
    [...input.tagIds].sort(),
    [...input.tagNames].sort(),
    input.categoryName ?? null,
    input.transactionType ?? null,
    input.amountMin ?? null,
    input.amountMax ?? null,
  ]);
  return createHash('sha256').update(fingerprint).digest('base64url').slice(0, 22);
}
