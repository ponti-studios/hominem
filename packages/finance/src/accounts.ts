import crypto from 'node:crypto';

import { db, sql } from '@hominem/db/core';
import type { AppFinanceAccounts } from '@hominem/db/types';
import type { Insertable, Selectable, Updateable } from 'kysely';

import { ensureInstitutionExists } from './institutions';
import { getAffectedRows } from './utils';

export type AccountWithBalance = Selectable<AppFinanceAccounts> & { currentBalance: number };

type CreateAccountInput = Partial<Insertable<AppFinanceAccounts>> & {
  userId: string;
  name: string;
};

type UpdateAccountInput = Partial<Updateable<AppFinanceAccounts>> & {
  id: string;
  userId?: string;
};

type UpsertAccountInput = Partial<Insertable<AppFinanceAccounts>> & {
  userId: string;
};

async function getBalances(accountIds: string[]): Promise<Map<string, number>> {
  if (accountIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .selectFrom('app.financeTransactions')
    .select((eb) => ['accountId', eb.fn.sum<number>('amount').as('balance')])
    .where('accountId', 'in', accountIds)
    .where('pending', '=', false)
    .groupBy('accountId')
    .execute();

  return new Map(rows.map((row) => [row.accountId, Number(row.balance ?? 0)]));
}

async function withBalance<T extends Selectable<AppFinanceAccounts>>(
  account: T,
): Promise<T & { currentBalance: number }> {
  const balances = await getBalances([account.id]);
  return { ...account, currentBalance: balances.get(account.id) ?? 0 };
}

async function withBalances<T extends Selectable<AppFinanceAccounts>>(
  accounts: T[],
): Promise<(T & { currentBalance: number })[]> {
  const balances = await getBalances(accounts.map((account) => account.id));
  return accounts.map((account) => ({
    ...account,
    currentBalance: balances.get(account.id) ?? 0,
  }));
}

export async function createAccount(input: CreateAccountInput): Promise<AccountWithBalance> {
  const id = input.id ?? crypto.randomUUID();
  const accountType = input.accountType ?? 'checking';

  const result = await db
    .insertInto('app.financeAccounts')
    .values({
      id,
      userId: input.userId,
      name: input.name,
      accountType,
      metadata: input.metadata ?? {},
      ...(input.plaidAccountId ? { plaidAccountId: input.plaidAccountId } : {}),
      ...(input.plaidItemId ? { plaidItemId: input.plaidItemId } : {}),
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Failed to create account');
  }

  return withBalance(result);
}

export interface CreateOrGetAccountInput {
  userId: string;
  name: string;
  currencyCode: string;
  institution?: string | null;
  mask?: string | null;
  status?: 'open' | 'closed';
  accountType?: string;
  dryRun?: boolean;
}

export interface CreateOrGetAccountResult {
  id: string | null;
  name: string;
  currencyCode: string;
  status: string;
  created: boolean;
}

/**
 * Create an account, or return the existing one when the name matches
 * case-insensitively. Open and closed accounts both match, so re-creating a
 * closed account returns it instead of duplicating it. `dryRun` reports the
 * outcome without writing; a would-be create has no id yet.
 */
export async function createOrGetAccount(
  input: CreateOrGetAccountInput,
): Promise<CreateOrGetAccountResult> {
  const name = input.name.trim();
  const existing = await db
    .selectFrom('app.financeAccounts')
    .select(['id', 'name', 'currencyCode', 'lifecycleStatus'])
    .where('userId', '=', input.userId)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .orderBy('id', 'asc')
    .limit(1)
    .executeTakeFirst();

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      currencyCode: existing.currencyCode,
      status: existing.lifecycleStatus,
      created: false,
    };
  }

  const status = input.status ?? 'open';
  if (input.dryRun) {
    return {
      id: null,
      name,
      currencyCode: input.currencyCode.toUpperCase(),
      status,
      created: true,
    };
  }

  const id = crypto.randomUUID();
  const currencyCode = input.currencyCode.toUpperCase();
  const institutionId = input.institution
    ? (await ensureInstitutionExists(input.institution)).id
    : null;
  await db
    .insertInto('app.financeAccounts')
    .values({
      id,
      userId: input.userId,
      name,
      currencyCode,
      lifecycleStatus: status,
      accountType: input.accountType ?? 'checking',
      metadata: {},
      ...(institutionId ? { institutionId } : {}),
      ...(input.mask ? { mask: input.mask } : {}),
    })
    .execute();

  return { id, name, currencyCode, status, created: true };
}

function accountsForUser(userId: string) {
  return db
    .selectFrom('app.financeAccounts')
    .where('userId', '=', userId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc');
}

export async function listAccounts(
  userId: string,
  options?: { includeClosed?: boolean; limit?: number },
): Promise<AccountWithBalance[]> {
  let query = accountsForUser(userId);
  if (!options?.includeClosed) {
    query = query.where('lifecycleStatus', '!=', 'closed');
  }
  if (options?.limit !== undefined) {
    query = query.limit(options.limit);
  }
  const accounts = await query.selectAll().execute();
  return withBalances(accounts);
}

export async function countAccounts(
  userId: string,
  options?: { includeClosed?: boolean },
): Promise<number> {
  let query = db
    .selectFrom('app.financeAccounts')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('userId', '=', userId);
  if (!options?.includeClosed) {
    query = query.where('lifecycleStatus', '!=', 'closed');
  }
  const row = await query.executeTakeFirst();
  return Number(row?.count ?? 0);
}

export async function getAccountById(
  accountId: string,
  userId?: string,
): Promise<AccountWithBalance | null> {
  if (userId) {
    const result = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('id', '=', accountId)
      .where('userId', '=', userId)
      .limit(1)
      .executeTakeFirst();
    return result ? withBalance(result) : null;
  }

  const result = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('id', '=', accountId)
    .limit(1)
    .executeTakeFirst();
  return result ? withBalance(result) : null;
}

export async function updateAccount(input: UpdateAccountInput): Promise<AccountWithBalance | null> {
  const existing = await getAccountById(input.id, input.userId);
  if (!existing) {
    return null;
  }

  const nextName = input.name ?? existing.name;
  const nextType = input.accountType ?? existing.accountType;

  const result = await db
    .updateTable('app.financeAccounts')
    .set({
      name: nextName,
      accountType: nextType,
      metadata: input.metadata ?? existing.metadata,
      updatedAt: new Date(),
    })
    .where('id', '=', input.id)
    .where('userId', '=', existing.userId)
    .returningAll()
    .executeTakeFirst();

  return result ? withBalance(result) : null;
}

export async function deleteAccount(accountId: string, userId?: string): Promise<boolean> {
  if (userId) {
    const result = await db
      .deleteFrom('app.financeAccounts')
      .where('id', '=', accountId)
      .where('userId', '=', userId)
      .executeTakeFirst();
    return getAffectedRows(result) > 0;
  }

  const result = await db
    .deleteFrom('app.financeAccounts')
    .where('id', '=', accountId)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export interface AccountImportSnapshot {
  id: string;
  name: string;
  mask: string | null;
  csvImportKey: string | null;
}

/** Narrow account rows for the import preflight flow (no balance queries). */
export async function listImportAccountSnapshots(userId: string): Promise<AccountImportSnapshot[]> {
  return accountsForUser(userId).select(['id', 'name', 'mask', 'csvImportKey']).execute();
}

/** How many of the given ids are owned by the user (idempotency/ownership guard). */
export async function countOwnedAccounts(userId: string, accountIds: string[]): Promise<number> {
  const uniqueIds = [...new Set(accountIds)];
  if (uniqueIds.length === 0) return 0;
  const rows = await db
    .selectFrom('app.financeAccounts')
    .select('id')
    .where('userId', '=', userId)
    .where('id', 'in', uniqueIds)
    .execute();
  return rows.length;
}

export async function getAccountsForInstitution(
  institutionId: string,
  userId: string,
): Promise<AccountWithBalance[]> {
  const accounts = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('userId', '=', userId)
    .where('institutionId', '=', institutionId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();

  return withBalances(accounts);
}

export async function upsertAccount(input: UpsertAccountInput): Promise<AccountWithBalance> {
  if (!input.name) {
    throw new Error('upsertAccount requires name');
  }

  if (input.plaidAccountId) {
    const existingResult = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', input.userId)
      .where('plaidAccountId', '=', input.plaidAccountId)
      .limit(1)
      .executeTakeFirst();
    const existing = existingResult ?? null;
    if (existing) {
      const updated = await updateAccount({
        id: existing.id,
        userId: input.userId,
        name: input.name,
        ...(input.accountType ? { accountType: input.accountType } : {}),
        metadata: input.metadata,
      });
      if (!updated) {
        throw new Error('Failed to update existing plaid account');
      }
      return updated;
    }
  }

  return createAccount({
    userId: input.userId,
    name: input.name,
    ...(input.id !== undefined ? { id: input.id } : {}),
    ...(input.accountType ? { accountType: input.accountType } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.plaidAccountId ? { plaidAccountId: input.plaidAccountId } : {}),
    ...(input.plaidItemId ? { plaidItemId: input.plaidItemId } : {}),
  });
}

export async function getUserAccounts(
  userId: string,
  itemId?: string,
): Promise<AccountWithBalance[]> {
  if (!itemId) {
    return listAccounts(userId);
  }

  const accounts = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('userId', '=', userId)
    .where('plaidItemId', '=', itemId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();

  return withBalances(accounts);
}

export async function getAccountByPlaidId(
  plaidAccountId: string,
  userId?: string,
): Promise<AccountWithBalance | null> {
  if (userId) {
    const result = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .where('plaidAccountId', '=', plaidAccountId)
      .limit(1)
      .executeTakeFirst();
    return result ? withBalance(result) : null;
  }

  const result = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('plaidAccountId', '=', plaidAccountId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'asc')
    .limit(1)
    .executeTakeFirst();
  return result ? withBalance(result) : null;
}

export interface AccountSummary {
  accountId: string;
  accountName: string;
  status: string;
  transactionCount: number;
  excludedCount: number;
  totals: Array<{ currencyCode: string; sumAmount: number }>;
  minPostedOn: string | null;
  maxPostedOn: string | null;
}

export interface AccountSummaries {
  summaries: AccountSummary[];
  totalCount: number;
}

/**
 * Per-account reconciliation totals: transaction and excluded counts, per-currency sums, and
 * the posted-on span. Counts and sums cover every row (pending and excluded included) so the
 * figures reconcile against a full ledger enumeration. Closed accounts are included by
 * default — reconciliation has to see everything.
 */
export async function getAccountSummaries(
  userId: string,
  options?: { accountId?: string; includeClosed?: boolean },
): Promise<AccountSummaries> {
  const includeClosed = options?.includeClosed ?? true;
  let accountQuery = db
    .selectFrom('app.financeAccounts')
    .select(['id', 'name', 'lifecycleStatus'])
    .where('userId', '=', userId);
  if (!includeClosed) {
    accountQuery = accountQuery.where('lifecycleStatus', '!=', 'closed');
  }
  if (options?.accountId) {
    accountQuery = accountQuery.where('id', '=', options.accountId);
  }
  accountQuery = accountQuery.orderBy('name', 'asc').orderBy('id', 'asc');
  const accounts = await accountQuery.execute();

  const accountIds = accounts.map((account) => account.id);
  const totals = new Map<string, Array<{ currencyCode: string; sumAmount: number }>>();
  const counts = new Map<string, { count: number; min: string | null; max: string | null }>();
  const excluded = new Map<string, number>();

  if (accountIds.length > 0) {
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select((eb) => [
        'accountId',
        'currencyCode',
        eb.fn.countAll<number>().as('txCount'),
        eb.fn.sum<number>('amount').as('sumAmount'),
        eb.fn.min('postedOn').as('minPostedOn'),
        eb.fn.max('postedOn').as('maxPostedOn'),
      ])
      .where('userId', '=', userId)
      .where('accountId', 'in', accountIds)
      .groupBy(['accountId', 'currencyCode'])
      .execute();

    for (const row of rows) {
      const currencyTotals = totals.get(row.accountId) ?? [];
      currencyTotals.push({
        currencyCode: row.currencyCode,
        sumAmount: Number(row.sumAmount ?? 0),
      });
      totals.set(row.accountId, currencyTotals);

      const accountCount = counts.get(row.accountId) ?? { count: 0, min: null, max: null };
      accountCount.count += Number(row.txCount);
      if (
        row.minPostedOn !== null &&
        (accountCount.min === null || row.minPostedOn < accountCount.min)
      ) {
        accountCount.min = row.minPostedOn;
      }
      if (
        row.maxPostedOn !== null &&
        (accountCount.max === null || row.maxPostedOn > accountCount.max)
      ) {
        accountCount.max = row.maxPostedOn;
      }
      counts.set(row.accountId, accountCount);
    }

    const excludedRows = await db
      .selectFrom('app.financeTransactions')
      .select((eb) => ['accountId', eb.fn.countAll<number>().as('excludedCount')])
      .where('userId', '=', userId)
      .where('accountId', 'in', accountIds)
      .where('excluded', '=', true)
      .groupBy('accountId')
      .execute();
    for (const row of excludedRows) {
      excluded.set(row.accountId, Number(row.excludedCount));
    }
  }

  const summaries = accounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    status: account.lifecycleStatus,
    transactionCount: counts.get(account.id)?.count ?? 0,
    excludedCount: excluded.get(account.id) ?? 0,
    totals: (totals.get(account.id) ?? []).sort((a, b) =>
      a.currencyCode.localeCompare(b.currencyCode),
    ),
    minPostedOn: counts.get(account.id)?.min ?? null,
    maxPostedOn: counts.get(account.id)?.max ?? null,
  }));

  return { summaries, totalCount: summaries.length };
}
