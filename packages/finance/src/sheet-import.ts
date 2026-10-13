import { createHash, randomUUID } from 'node:crypto';

import { db, sql } from '@hominem/db/core';
import { ValidationError } from '@hominem/db/errors';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { toNumber } from './utils';

export const SHEET_SOURCE_VALUES = ['plaid', 'starling', 'manual'] as const;
export type SheetSource = (typeof SHEET_SOURCE_VALUES)[number];

export const UNCATEGORIZED_NAME = 'Uncategorized';

export interface SheetTransactionInput {
  postedOn: string;
  /** Sheet Bank label or a Hominem account id (uuid). */
  account: string;
  description: string;
  amountCents: number;
  currencyCode: string;
  category?: string | null;
  tags?: string[];
  notes?: string | null;
  /** Sheet col H — appended into notes when present. */
  orderNumber?: string | null;
  source?: string | null;
  excluded?: boolean;
  recurring?: boolean;
  transactionType?: 'debit' | 'credit' | 'transfer' | null;
  /** v1 has no pending state — pending rows are rejected loudly. */
  pending?: boolean;
  /** Other leg of an internal transfer; must exist, be owned, and sit on a different account. */
  counterpartId?: string | null;
}

export interface SheetImportOptions {
  accountMap?: Record<string, string>;
  /** Sheet labels or account ids exempt from the currency sanity check. */
  multiCurrencyAccounts?: string[];
}

export interface SheetBatchOptions extends SheetImportOptions {
  mode?: 'append' | 'replace';
  dryRun?: boolean;
  /** Explicit confirmation for mode: "replace". */
  iUnderstand?: boolean;
}

export type SheetRejectionReason =
  | 'unknown_account'
  | 'currency_mismatch'
  | 'invalid_posted_on'
  | 'invalid_amount'
  | 'invalid_currency'
  | 'invalid_description'
  | 'invalid_counterpart'
  | 'pending_row';

export interface SheetImportRowResult {
  index: number;
  ok: boolean;
  id?: string;
  created?: boolean;
  accountId?: string;
  reason?: SheetRejectionReason;
}

export interface SheetImportSummary {
  received: number;
  upserted: number;
  created: number;
  updated: number;
  rejected: Array<{ index: number; reason: SheetRejectionReason }>;
  accountsAutoProvisioned: string[];
}

export function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').toLowerCase();
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function normalizeSource(value: string | null | undefined): SheetSource {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'plaid' || normalized === 'starling') return normalized;
  return 'manual';
}

export function inferTransactionType(
  description: string,
  amountCents: number,
  explicit?: 'debit' | 'credit' | 'transfer' | null,
): 'debit' | 'credit' | 'transfer' | 'adjustment' {
  if (explicit === 'debit' || explicit === 'credit' || explicit === 'transfer') return explicit;
  if (/transfer/i.test(description)) return 'transfer';
  if (amountCents > 0) return 'credit';
  if (amountCents < 0) return 'debit';
  // Zero-amount rows are authorizations/placeholders with no direction; `adjustment` is the
  // schema's existing home for a non-directional entry (the column's CHECK allows it).
  return 'adjustment';
}

export function combineNotes(
  notes: string | null | undefined,
  orderNumber: string | null | undefined,
): string | null {
  const parts: string[] = [];
  const trimmedNotes = (notes ?? '').trim();
  if (trimmedNotes) parts.push(trimmedNotes);
  const trimmedOrder = (orderNumber ?? '').trim();
  if (trimmedOrder) parts.push(`Order #: ${trimmedOrder}`);
  if (parts.length === 0) return null;
  return parts.join('\n').slice(0, 2000);
}

/**
 * Read the order number back out of `notes` — there is no order-number column, the write
 * path folds it into notes as an `Order #: <value>` line (see combineNotes). Returns null
 * when the notes carry no order number.
 */
export function extractOrderNumber(notes: string | null | undefined): string | null {
  if (!notes) return null;
  for (const line of notes.split('\n')) {
    const match = /^Order #:\s*(.+)$/.exec(line.trim());
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

export function parseTags(tags: string[] | undefined): string[] {
  if (!tags) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    for (const piece of String(raw).split(',')) {
      const trimmed = piece.trim();
      if (!trimmed || seen.has(trimmed.toLowerCase())) continue;
      seen.add(trimmed.toLowerCase());
      result.push(trimmed);
    }
  }
  return result;
}

export function computeSheetExternalId(
  postedOn: string,
  accountId: string,
  description: string,
  amountCents: number,
  currencyCode: string,
): string {
  const key = [
    postedOn,
    accountId,
    normalizeDescription(description),
    amountCents,
    currencyCode,
  ].join('|');
  // SHA-256, not the PRD's SHA-1: same internal dedup role, no CodeQL-class
  // weakness, zero interop cost (keys never leave the `sheet:` namespace).
  return `sheet:${createHash('sha256').update(key).digest('hex')}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateRow(input: SheetTransactionInput): SheetRejectionReason | null {
  if (input.pending) return 'pending_row';
  if (!isIsoDate(input.postedOn)) return 'invalid_posted_on';
  if (!Number.isInteger(input.amountCents)) return 'invalid_amount';
  if (!/^[A-Za-z]{3}$/.test(input.currencyCode ?? '')) return 'invalid_currency';
  if (!input.description || !input.description.trim()) return 'invalid_description';
  if (!input.account || !input.account.trim()) return 'unknown_account';
  return null;
}

// Replace arming binds a clean dry run to its exact payload: user → set of
// {fingerprint, accountMap, multiCurrencyAccounts}. A replace consumes the
// matching arm, so every wipe needs a fresh dry run of the same rows with
// the same options. Process-local by design (same-session guard).
const KNOWN_REJECTION_MESSAGES: readonly SheetRejectionReason[] = [
  'unknown_account',
  'currency_mismatch',
  'invalid_posted_on',
  'invalid_amount',
  'invalid_currency',
  'invalid_description',
  'invalid_counterpart',
  'pending_row',
];

/**
 * Classify a write-phase failure: recognized domain reasons are collected
 * per row, anything else (unique-index race, tag insert failure, transient
 * database error) rethrows so the batch fails loudly instead of masquerading
 * as an ordinary data rejection.
 */
export function toSheetRejectionReason(error: unknown): SheetRejectionReason | null {
  const message = error instanceof Error ? error.message : String(error);
  for (const known of KNOWN_REJECTION_MESSAGES) {
    if (known === message) return known;
  }
  return null;
}

export interface ValidatedSheetRow {
  index: number;
  input: SheetTransactionInput;
  accountId: string;
  currencyCode: string;
  externalId: string;
  counterpartId: string | null;
}

export interface SheetBatchValidation {
  valid: ValidatedSheetRow[];
  rejected: Array<{ index: number; reason: SheetRejectionReason }>;
}

/**
 * Resolve a transfer counterpart: it must be an owned transaction on a *different* account.
 * Anything else is `invalid_counterpart` — the model holds a link once it is known, it never
 * guesses one.
 */
async function resolveCounterpartId(
  userId: string,
  counterpartId: string,
  accountId: string,
): Promise<string> {
  const target = await db
    .selectFrom('app.financeTransactions')
    .select(['id', 'accountId'])
    .where('id', '=', counterpartId)
    .where('userId', '=', userId)
    .limit(1)
    .executeTakeFirst();
  if (!target || target.accountId === accountId) throw new Error('invalid_counterpart');
  return target.id;
}

/** Validate + resolve a batch with zero writes. Shared by dry runs, the
 * replace pre-wipe check, and the write phase. */
export async function validateSheetBatch(
  userId: string,
  transactions: SheetTransactionInput[],
  accountMap?: Record<string, string>,
  multiCurrencyAccounts?: string[],
): Promise<SheetBatchValidation> {
  const valid: ValidatedSheetRow[] = [];
  const rejected: Array<{ index: number; reason: SheetRejectionReason }> = [];
  for (let index = 0; index < transactions.length; index++) {
    const input = transactions[index];
    const invalid = validateRow(input);
    if (invalid) {
      rejected.push({ index, reason: invalid });
      continue;
    }
    const resolved = await resolveAccount(userId, input.account, accountMap);
    if ('reason' in resolved) {
      rejected.push({ index, reason: resolved.reason });
      continue;
    }
    const currencyCode = input.currencyCode.toUpperCase();
    if (
      currencyCode !== resolved.currencyCode.toUpperCase() &&
      !isMultiCurrencyAllowed(input.account, resolved, multiCurrencyAccounts)
    ) {
      rejected.push({ index, reason: 'currency_mismatch' });
      continue;
    }
    let counterpartId: string | null = null;
    if (input.counterpartId) {
      try {
        counterpartId = await resolveCounterpartId(userId, input.counterpartId, resolved.accountId);
      } catch {
        rejected.push({ index, reason: 'invalid_counterpart' });
        continue;
      }
    }
    valid.push({
      index,
      input,
      accountId: resolved.accountId,
      currencyCode,
      counterpartId,
      externalId: computeSheetExternalId(
        input.postedOn,
        resolved.accountId,
        input.description.trim(),
        input.amountCents,
        currencyCode,
      ),
    });
  }
  return { valid, rejected };
}

export async function ensureFinanceCategoryId(
  userId: string,
  name: string | null | undefined,
): Promise<string> {
  const trimmed = (name ?? '').trim();
  const target = trimmed || UNCATEGORIZED_NAME;
  const existing = await db
    .selectFrom('app.financeCategories')
    .select('id')
    .where('userId', '=', userId)
    .where(sql<string>`lower(name)`, '=', target.toLowerCase())
    .limit(1)
    .executeTakeFirst();
  if (existing) return existing.id;
  const inserted = await db
    .insertInto('app.financeCategories')
    .values({ id: randomUUID(), userId, name: target })
    .onConflict((oc) => oc.column('id').doNothing())
    .returning('id')
    .executeTakeFirst();
  if (inserted) return inserted.id;
  const retry = await db
    .selectFrom('app.financeCategories')
    .select('id')
    .where('userId', '=', userId)
    .where(sql<string>`lower(name)`, '=', target.toLowerCase())
    .limit(1)
    .executeTakeFirstOrThrow();
  return retry.id;
}

export interface CreateFinanceCategoryResult {
  id: string | null;
  name: string;
  created: boolean;
}

/**
 * Create a finance category, or return the existing one when the name matches
 * case-insensitively — the same identity rule the import's ensure step uses. `dryRun` reports
 * the outcome without writing; a would-be create has no id yet.
 */
export async function createOrGetFinanceCategory(
  userId: string,
  name: string,
  options?: { dryRun?: boolean },
): Promise<CreateFinanceCategoryResult> {
  const trimmed = name.trim();
  const existing = await db
    .selectFrom('app.financeCategories')
    .select(['id', 'name'])
    .where('userId', '=', userId)
    .where(sql<string>`lower(name)`, '=', trimmed.toLowerCase())
    .limit(1)
    .executeTakeFirst();
  if (existing) return { id: existing.id, name: existing.name, created: false };
  if (options?.dryRun) return { id: null, name: trimmed, created: true };

  const id = randomUUID();
  await db.insertInto('app.financeCategories').values({ id, userId, name: trimmed }).execute();
  return { id, name: trimmed, created: true };
}

export type FinanceCategoryMergeReason = 'protected_category' | 'unknown_category';

export interface MergeFinanceCategoriesResult {
  transactionsReassigned: number;
  category: { id: string; name: string } | null;
  reason: FinanceCategoryMergeReason | null;
}

async function resolveFinanceCategory(
  userId: string,
  nameOrId: string,
): Promise<{ id: string; name: string } | null> {
  const trimmed = nameOrId.trim();
  const base = db
    .selectFrom('app.financeCategories')
    .select(['id', 'name'])
    .where('userId', '=', userId);
  const row = UUID_PATTERN.test(trimmed)
    ? await base.where('id', '=', trimmed).limit(1).executeTakeFirst()
    : await base
        .where(sql<string>`lower(name)`, '=', trimmed.toLowerCase())
        .limit(1)
        .executeTakeFirst();
  return row ?? null;
}

/**
 * Reassign every transaction from one category to another. The emptied category is left in
 * place (budgets reference categories) but unused. `Uncategorized` may be a target, never a
 * source. `dryRun` counts what would move without writing.
 */
export async function mergeFinanceCategories(
  userId: string,
  input: { from: string; into: string },
  options?: { dryRun?: boolean },
): Promise<MergeFinanceCategoriesResult> {
  const source = await resolveFinanceCategory(userId, input.from);
  if (!source) return { transactionsReassigned: 0, category: null, reason: 'unknown_category' };
  if (source.name.toLowerCase() === UNCATEGORIZED_NAME.toLowerCase()) {
    return { transactionsReassigned: 0, category: null, reason: 'protected_category' };
  }

  const target = await resolveFinanceCategory(userId, input.into);
  if (!target) return { transactionsReassigned: 0, category: null, reason: 'unknown_category' };

  if (source.id === target.id) {
    return { transactionsReassigned: 0, category: target, reason: null };
  }

  if (options?.dryRun) {
    const row = await db
      .selectFrom('app.financeTransactions')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('userId', '=', userId)
      .where('categoryId', '=', source.id)
      .executeTakeFirst();
    return { transactionsReassigned: Number(row?.count ?? 0), category: target, reason: null };
  }

  const result = await db
    .updateTable('app.financeTransactions')
    .set({ categoryId: target.id })
    .where('userId', '=', userId)
    .where('categoryId', '=', source.id)
    .executeTakeFirst();

  return {
    transactionsReassigned: Number(result.numUpdatedRows),
    category: target,
    reason: null,
  };
}

export async function listFinanceCategories(
  userId: string,
): Promise<Array<{ id: string; name: string }>> {
  const rows = await db
    .selectFrom('app.financeCategories')
    .select(['id', 'name'])
    .where('userId', '=', userId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .limit(500)
    .execute();
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

async function ensureTagIds(userId: string, names: string[]): Promise<string[]> {
  const ids: string[] = [];
  for (const name of names) {
    // app.tags is unique on (owner, lower(name)) and on (owner, slug), but a sheet tag
    // arrives with whatever casing the sheet used. Match case-insensitively so "Art" finds
    // the existing "art" instead of attempting an insert that the unique index rejects.
    const existing = await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', '=', userId)
      .where(sql<boolean>`lower(name) = lower(${name})`)
      .limit(1)
      .executeTakeFirst();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const path = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const inserted = await db
      .insertInto('app.tags')
      .values({ id: randomUUID(), ownerUserid: userId, name, slug, path })
      .onConflict((oc) => oc.doNothing())
      .returning('id')
      .executeTakeFirst();
    if (inserted) {
      ids.push(inserted.id);
      continue;
    }
    // No row inserted: either unique index already holds this tag — under a different
    // casing, or (via the slug) an equivalent name. Reuse it rather than fail the write.
    const retry = await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', '=', userId)
      .where(sql<boolean>`(lower(name) = lower(${name}) or slug = ${slug})`)
      .limit(1)
      .executeTakeFirstOrThrow();
    ids.push(retry.id);
  }
  return ids;
}

async function setTransactionTags(
  transactionId: string,
  userId: string,
  tagIds: string[],
): Promise<void> {
  const owned = await db
    .selectFrom('app.financeTransactions')
    .select('id')
    .where('id', '=', transactionId)
    .where('userId', '=', userId)
    .limit(1)
    .executeTakeFirst();
  if (!owned) return;
  await db
    .deleteFrom('app.tagAssignments')
    .where('entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
    .where('entityId', '=', transactionId)
    .execute();
  for (const tagId of new Set(tagIds)) {
    await db
      .insertInto('app.tagAssignments')
      .values({
        id: randomUUID(),
        tagId,
        entityTable: FINANCE_TRANSACTION_ENTITY_TYPE,
        entityId: transactionId,
      })
      .execute();
  }
}

async function resolveAccount(
  userId: string,
  account: string,
  accountMap?: Record<string, string>,
): Promise<
  { accountId: string; currencyCode: string; name: string } | { reason: SheetRejectionReason }
> {
  const trimmed = account.trim();
  const mapped = accountMap?.[trimmed];
  const candidates: string[] = [];
  if (mapped) candidates.push(mapped);
  if (UUID_PATTERN.test(trimmed)) candidates.push(trimmed);
  for (const id of candidates) {
    const row = await db
      .selectFrom('app.financeAccounts')
      .select(['id', 'currencyCode', 'name'])
      .where('id', '=', id)
      .where('userId', '=', userId)
      .limit(1)
      .executeTakeFirst();
    if (row) return { accountId: row.id, currencyCode: row.currencyCode, name: row.name };
  }
  if (mapped) {
    const named = await db
      .selectFrom('app.financeAccounts')
      .select(['id', 'currencyCode', 'name'])
      .where('userId', '=', userId)
      .where(sql<string>`lower(name)`, '=', mapped.toLowerCase())
      .limit(1)
      .executeTakeFirst();
    if (named) return { accountId: named.id, currencyCode: named.currencyCode, name: named.name };
    return { reason: 'unknown_account' };
  }
  const direct = await db
    .selectFrom('app.financeAccounts')
    .select(['id', 'currencyCode', 'name'])
    .where('userId', '=', userId)
    .where(sql<string>`lower(name)`, '=', trimmed.toLowerCase())
    .limit(1)
    .executeTakeFirst();
  if (direct) return { accountId: direct.id, currencyCode: direct.currencyCode, name: direct.name };
  return { reason: 'unknown_account' };
}

export function isMultiCurrencyAllowed(
  label: string,
  resolved: { accountId: string; name: string },
  allowlist: readonly string[] | undefined,
): boolean {
  if (!allowlist) return false;
  const wanted = new Set(allowlist.map((entry) => entry.trim().toLowerCase()));
  return (
    wanted.has(label.trim().toLowerCase()) ||
    wanted.has(resolved.accountId.toLowerCase()) ||
    wanted.has(resolved.name.toLowerCase())
  );
}

function assertCurrencyAllowed(
  label: string,
  rowCurrency: string,
  resolved: { accountId: string; currencyCode: string; name: string },
  allowlist: readonly string[] | undefined,
): void {
  if (rowCurrency === resolved.currencyCode.toUpperCase()) return;
  if (isMultiCurrencyAllowed(label, resolved, allowlist)) return;
  throw new Error('currency_mismatch');
}

async function getTransactionTagIds(transactionId: string, userId: string): Promise<string[]> {
  const result = await db
    .selectFrom('app.tagAssignments as ti')
    .innerJoin('app.tags as tg', (join) =>
      join.onRef('tg.id', '=', 'ti.tagId').on('tg.ownerUserid', '=', userId),
    )
    .select('ti.tagId')
    .where('ti.entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
    .where('ti.entityId', '=', transactionId)
    .execute();
  return result.map((row) => row.tagId);
}

/**
 * Mirror a transfer link: the counterpart points back at this row, and a link this row used to
 * hold is cleared from the other side, so re-pointing (or nulling) stays symmetric.
 */
async function applyCounterpartLink(
  userId: string,
  transactionId: string,
  previousCounterpartId: string | null,
  counterpartId: string | null,
): Promise<void> {
  if (previousCounterpartId && previousCounterpartId !== counterpartId) {
    await db
      .updateTable('app.financeTransactions')
      .set({ counterpartId: null })
      .where('id', '=', previousCounterpartId)
      .where('userId', '=', userId)
      .where('counterpartId', '=', transactionId)
      .execute();
  }
  if (counterpartId) {
    await db
      .updateTable('app.financeTransactions')
      .set({ counterpartId: transactionId })
      .where('id', '=', counterpartId)
      .where('userId', '=', userId)
      .execute();
  }
}

export async function upsertSheetTransaction(
  userId: string,
  input: SheetTransactionInput,
  accountMap?: Record<string, string>,
  options?: SheetImportOptions,
): Promise<{ id: string; created: boolean; updated: boolean; accountId: string }> {
  const invalid = validateRow(input);
  if (invalid) throw new Error(invalid);
  const resolved = await resolveAccount(userId, input.account, accountMap);
  if ('reason' in resolved) throw new Error(resolved.reason);
  const currencyCode = input.currencyCode.toUpperCase();
  assertCurrencyAllowed(input.account, currencyCode, resolved, options?.multiCurrencyAccounts);

  const counterpartId = input.counterpartId
    ? await resolveCounterpartId(userId, input.counterpartId, resolved.accountId)
    : null;

  const source = normalizeSource(input.source);
  const description = input.description.trim();
  const transactionType = inferTransactionType(
    description,
    input.amountCents,
    input.transactionType,
  );
  const externalId = computeSheetExternalId(
    input.postedOn,
    resolved.accountId,
    description,
    input.amountCents,
    currencyCode,
  );
  const categoryId = await ensureFinanceCategoryId(userId, input.category);
  const notes = combineNotes(input.notes, input.orderNumber);
  const amount = toNumber(input.amountCents) / 100;

  const existing = await db
    .selectFrom('app.financeTransactions')
    .select(['id', 'categoryId', 'counterpartId', 'excluded', 'notes', 'recurring', 'merchantName'])
    .where('userId', '=', userId)
    .where('source', '=', source)
    .where('externalId', '=', externalId)
    .limit(1)
    .executeTakeFirst();

  const tagIds = await ensureTagIds(userId, parseTags(input.tags));

  if (existing) {
    const excluded = input.excluded ?? false;
    const recurring = input.recurring ?? false;
    const currentTagIds = await getTransactionTagIds(existing.id, userId);
    const currentTagSet = new Set(currentTagIds);
    const nextTagSet = new Set(tagIds);
    let tagsSame = currentTagSet.size === nextTagSet.size;
    if (tagsSame) {
      for (const id of currentTagSet) {
        if (!nextTagSet.has(id)) {
          tagsSame = false;
          break;
        }
      }
    }
    const mutableSame =
      existing.categoryId === categoryId &&
      (existing.counterpartId ?? null) === counterpartId &&
      existing.excluded === excluded &&
      (existing.notes ?? null) === notes &&
      existing.recurring === recurring &&
      (existing.merchantName ?? null) === description &&
      tagsSame;
    if (mutableSame) {
      return { id: existing.id, created: false, updated: false, accountId: resolved.accountId };
    }
    await db
      .updateTable('app.financeTransactions')
      .set({
        categoryId,
        counterpartId,
        excluded,
        notes,
        recurring,
        merchantName: description,
      })
      .where('id', '=', existing.id)
      .where('userId', '=', userId)
      .execute();
    await applyCounterpartLink(userId, existing.id, existing.counterpartId, counterpartId);
    await setTransactionTags(existing.id, userId, tagIds);
    return { id: existing.id, created: false, updated: true, accountId: resolved.accountId };
  }

  const id = randomUUID();
  await db
    .insertInto('app.financeTransactions')
    .values({
      id,
      userId,
      accountId: resolved.accountId,
      amount,
      transactionType,
      description,
      merchantName: description,
      postedOn: input.postedOn,
      currencyCode,
      categoryId,
      counterpartId,
      excluded: input.excluded ?? false,
      recurring: input.recurring ?? false,
      notes,
      source,
      externalId,
    })
    .execute();
  await applyCounterpartLink(userId, id, null, counterpartId);
  await setTransactionTags(id, userId, tagIds);
  return { id, created: true, updated: false, accountId: resolved.accountId };
}

// Existing transaction tag names per id, owner-scoped, for the projection.
async function existingTransactionTagNames(
  userId: string,
  ids: readonly string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  if (ids.length === 0) return map;
  const rows = await db
    .selectFrom('app.tagAssignments as ta')
    .innerJoin('app.tags as tg', 'tg.id', 'ta.tagId')
    .select(['ta.entityId', 'tg.name'])
    .where('tg.ownerUserid', '=', userId)
    .where('ta.entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
    .where('ta.entityId', 'in', ids)
    .execute();
  for (const row of rows) {
    const set = map.get(row.entityId) ?? new Set<string>();
    set.add(row.name);
    map.set(row.entityId, set);
  }
  return map;
}

// Read-only projection of the create/update split for a dry run, mirroring what the real
// upsert would do: a replace dry run wipes the store first, so every row projects as a
// create; an append dry run counts a row as updated only when it actually changes
// (matching upsertSheetTransaction's mutable-field comparison), and leaves unchanged rows
// out of both counts.
async function projectImportSplit(
  userId: string,
  valid: ValidatedSheetRow[],
  mode: 'append' | 'replace',
): Promise<{ created: number; updated: number }> {
  if (mode === 'replace') return { created: valid.length, updated: 0 };

  const keys = valid.map((row) => ({
    row,
    source: normalizeSource(row.input.source),
    externalId: row.externalId,
  }));

  const existing = new Map<
    string,
    {
      id: string;
      categoryId: string | null;
      excluded: boolean;
      notes: string | null;
      recurring: boolean;
      merchantName: string | null;
    }
  >();
  const chunkSize = 250;
  for (let i = 0; i < keys.length; i += chunkSize) {
    const chunk = keys.slice(i, i + chunkSize);
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select([
        'id',
        'source',
        'externalId',
        'categoryId',
        'excluded',
        'notes',
        'recurring',
        'merchantName',
      ])
      .where('userId', '=', userId)
      .where((eb) =>
        eb.or(
          chunk.map((key) =>
            eb.and([eb('source', '=', key.source), eb('externalId', '=', key.externalId)]),
          ),
        ),
      )
      .execute();
    for (const row of rows) existing.set(`${row.source}|${row.externalId}`, row);
  }

  const [categories, existingTags] = await Promise.all([
    listFinanceCategories(userId),
    existingTransactionTagNames(
      userId,
      [...existing.values()].map((row) => row.id),
    ),
  ]);
  const categoryIdByName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );
  const incomingCategoryId = (name: string | null | undefined) => {
    const target = (name ?? '').trim() || UNCATEGORIZED_NAME;
    return categoryIdByName.get(target.toLowerCase()) ?? null;
  };

  let created = 0;
  let updated = 0;
  for (const key of keys) {
    const found = existing.get(`${key.source}|${key.externalId}`);
    if (!found) {
      created += 1;
      continue;
    }
    const input = key.row.input;
    const description = input.description.trim();
    const tagNames = new Set(parseTags(input.tags));
    const currentTags = existingTags.get(found.id) ?? new Set<string>();
    const tagsSame =
      tagNames.size === currentTags.size && [...tagNames].every((name) => currentTags.has(name));
    const unchanged =
      found.categoryId === incomingCategoryId(input.category) &&
      found.excluded === (input.excluded ?? false) &&
      (found.notes ?? null) === combineNotes(input.notes, input.orderNumber) &&
      found.recurring === (input.recurring ?? false) &&
      (found.merchantName ?? null) === description &&
      tagsSame;
    if (!unchanged) updated += 1;
  }
  return { created, updated };
}

export async function importSheetTransactions(
  userId: string,
  options: {
    transactions: SheetTransactionInput[];
    mode?: 'append' | 'replace';
    dryRun?: boolean;
    accountMap?: Record<string, string>;
    multiCurrencyAccounts?: string[];
    iUnderstand?: boolean;
  },
): Promise<SheetImportSummary> {
  const {
    transactions,
    mode = 'append',
    dryRun = false,
    accountMap,
    multiCurrencyAccounts,
    iUnderstand = false,
  } = options;
  const summary: SheetImportSummary = {
    received: transactions.length,
    upserted: 0,
    created: 0,
    updated: 0,
    rejected: [],
    accountsAutoProvisioned: [],
  };

  // Phase 1 validates everything before any write, so a replace never wipes
  // and then discovers rejections.
  const { valid, rejected } = await validateSheetBatch(
    userId,
    transactions,
    accountMap,
    multiCurrencyAccounts,
  );
  summary.rejected.push(...rejected);

  if (dryRun) {
    summary.upserted += valid.length;
    const split = await projectImportSplit(userId, valid, mode);
    summary.created = split.created;
    summary.updated = split.updated;
    return summary;
  }

  // Replace wipes the caller's transactions before inserting. It is gated on the explicit
  // confirmation (iUnderstand) and on the payload being fully valid — the batch was
  // validated above, so a replace can never wipe and then discover rejections. There is no
  // in-process dry-run "arm": that state did not survive a restart (it silently made
  // replace unusable after any deploy), and the inline validation is the guarantee it
  // provided.
  if (mode === 'replace') {
    if (!iUnderstand) {
      throw new ValidationError('mode "replace" requires iUnderstand: true.');
    }
    if (rejected.length > 0) {
      throw new ValidationError(
        `mode "replace" refused: ${rejected.length} row(s) would be rejected; fix them and retry (nothing was wiped).`,
      );
    }
    await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
  }

  for (const row of valid) {
    try {
      const result = await upsertSheetTransaction(userId, row.input, accountMap, {
        multiCurrencyAccounts,
      });
      summary.upserted += 1;
      if (result.created) summary.created += 1;
      else if (result.updated) summary.updated += 1;
    } catch (error) {
      const reason = toSheetRejectionReason(error);
      if (!reason) throw error;
      summary.rejected.push({ index: row.index, reason });
    }
  }
  return summary;
}
