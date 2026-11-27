// The one place finance test data gets written. Test files say what they need; this does the writing.
// Everything takes overrides typed from the real tables, so a column rename breaks here, loudly.
import { randomUUID } from 'node:crypto';

import { authDb, db, type Insertable, sql, type Updateable } from '@hominem/db/core';
import type {
  AppFinanceAccounts,
  AppFinanceBills,
  AppFinanceBudgets,
  AppFinanceCategories,
  AppFinanceMonthlyBudgets,
  AppFinanceRunwayPreferences,
  AppFinanceTransactions,
  AppTags,
} from '@hominem/db/types/database';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from '../contracts';
import { createTransaction } from '../transactions';

type With<Table, Required extends keyof Insertable<Table>> = Partial<Insertable<Table>> &
  Pick<Insertable<Table>, Required>;

export async function seedUser(input: { id?: string; name?: string; email?: string } = {}) {
  const id = input.id ?? randomUUID();
  const user = {
    id,
    name: input.name ?? 'Finance Fixture User',
    email: input.email ?? `${id}@test.hominem.dev`,
    emailVerified: true,
  };
  await authDb.insertInto('user').values(user).execute();
  return user;
}

/**
 * Deletes the users and everything they own. Most tables cascade from `user`; rules hold a RESTRICT
 * reference to categories, and categories don't cascade, so those go by hand, in this order.
 */
export async function removeUsers(...userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  await db.transaction().execute(async (trx) => {
    await trx.deleteFrom('app.financeRules').where('userId', 'in', userIds).execute();
    await trx
      .deleteFrom('app.tagAssignments')
      .where('entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
      .where('entityId', 'in', (eb) =>
        eb.selectFrom('app.financeTransactions').select('id').where('userId', 'in', userIds),
      )
      .execute();
    await trx.deleteFrom('app.financeTransactions').where('userId', 'in', userIds).execute();
    await trx.deleteFrom('app.financeCategories').where('userId', 'in', userIds).execute();
  });
  await authDb.deleteFrom('user').where('id', 'in', userIds).execute();
}

/** For suites with fixed ids: wipes whatever a previous run left behind, then seeds fresh users. */
export async function resetUsers(...userIds: string[]): Promise<void> {
  await removeUsers(...userIds);
  for (const id of userIds) await seedUser({ id });
}

export function seedAccount(input: With<AppFinanceAccounts, 'userId'>) {
  return db
    .insertInto('app.financeAccounts')
    .values({ name: 'Fixture Account', accountType: 'checking', ...input })
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Seeds accounts in order, all owned by `userId` unless a row says otherwise. */
export async function seedAccounts(
  userId: string,
  rows: Array<Partial<Insertable<AppFinanceAccounts>>>,
) {
  const created = [];
  for (const row of rows) created.push(await seedAccount({ userId, ...row }));
  return created;
}

/** For suites sharing one long-lived user: seeds accounts with fixed ids unless they're already there. */
export async function ensureAccounts(
  userId: string,
  rows: Array<Partial<Insertable<AppFinanceAccounts>> & { id: string }>,
): Promise<void> {
  for (const row of rows) {
    await db
      .insertInto('app.financeAccounts')
      .values({ name: 'Fixture Account', accountType: 'checking', userId, ...row })
      .onConflict((conflict) => conflict.column('id').doNothing())
      .execute();
  }
}

/** A throwaway category with one budget on it, plus the teardown for both. */
export async function seedBudgetedCategory(userId: string, name = `Budgeted ${randomUUID()}`) {
  const category = await seedCategory({ userId, name });
  const budget = await seedBudget({
    userId,
    categoryId: category.id,
    amountCents: 2500,
    cadence: 'monthly',
  });
  return {
    categoryId: category.id,
    categoryName: category.name,
    budgetId: budget.id,
    cleanup: async () => {
      await db.deleteFrom('app.financeBudgets').where('id', '=', budget.id).execute();
      await db.deleteFrom('app.financeCategories').where('id', '=', category.id).execute();
    },
  };
}

/** For columns the production `updateAccount` doesn't expose, like allowed currencies. */
export async function patchAccount(id: string, patch: Updateable<AppFinanceAccounts>) {
  await db.updateTable('app.financeAccounts').set(patch).where('id', '=', id).execute();
}

export function seedCategory(input: With<AppFinanceCategories, 'userId' | 'name'>) {
  return db
    .insertInto('app.financeCategories')
    .values(input)
    .returningAll()
    .executeTakeFirstOrThrow();
}

/** Goes through the production `createTransaction`, so fixtures can't drift from the real write. */
export function seedTransaction(input: Parameters<typeof createTransaction>[0]) {
  return createTransaction(input);
}

/** Seeds rows in order, all owned by `userId` unless a row says otherwise. */
export async function seedTransactions(
  userId: string,
  rows: Array<Omit<Parameters<typeof createTransaction>[0], 'userId'> & { userId?: string }>,
) {
  const created = [];
  for (const row of rows) created.push(await seedTransaction({ userId, ...row }));
  return created;
}

/** Bulk insert for scale cases, where one write per row would crawl. Returns the new ids. */
export async function seedRepeatedTransactions(
  count: number,
  row: Omit<Insertable<AppFinanceTransactions>, 'id' | 'externalId'>,
): Promise<string[]> {
  const rows = Array.from({ length: count }, () => {
    const id = randomUUID();
    return { ...row, id, externalId: id };
  });
  for (let start = 0; start < rows.length; start += 1000) {
    await db
      .insertInto('app.financeTransactions')
      .values(rows.slice(start, start + 1000))
      .execute();
  }
  return rows.map((entry) => entry.id);
}

/** Debit rows sharing an owner, account, category and date, written in bulk for large merges. */
export async function seedCategorizedRows(
  shared: Pick<
    Insertable<AppFinanceTransactions>,
    'userId' | 'accountId' | 'categoryId' | 'postedOn'
  >,
  rows: Array<Pick<Insertable<AppFinanceTransactions>, 'id' | 'description' | 'amount'>>,
): Promise<void> {
  for (let start = 0; start < rows.length; start += 1000) {
    await db
      .insertInto('app.financeTransactions')
      .values(
        rows
          .slice(start, start + 1000)
          .map((row) => ({ ...shared, transactionType: 'debit', ...row })),
      )
      .execute();
  }
}

export function seedTag(input: With<AppTags, 'ownerUserid' | 'name'>) {
  const slug = input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return db
    .insertInto('app.tags')
    .values({ ...input, slug, path: input.path ?? slug.replace(/-/g, '_') })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function seedTagAssignments(
  tagId: string,
  entityIds: string[],
  options: { entityTable?: string; assignmentSource?: string } = {},
): Promise<void> {
  if (entityIds.length === 0) return;
  const table = options.entityTable ?? FINANCE_TRANSACTION_ENTITY_TYPE;
  await db
    .insertInto('app.tagAssignments')
    .values(
      entityIds.map((entityId) => ({
        tagId,
        entityId,
        entityTable: sql<string>`${table}::regclass`,
        assignmentSource: options.assignmentSource,
      })),
    )
    .execute();
}

/** A tag plus its assignments in one go. */
export async function seedTagOn(input: Parameters<typeof seedTag>[0], entityIds: string[]) {
  const tag = await seedTag(input);
  await seedTagAssignments(tag.id, entityIds);
  return tag;
}

/**
 * Remembers which transactions and tags these users own right now. The returned function deletes
 * anything added since, so cases can share one baseline without leaking into each other.
 */
export async function keepBaseline(...userIds: string[]): Promise<() => Promise<void>> {
  const owned = async () => ({
    transactions: await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('userId', 'in', userIds)
      .execute(),
    tags: await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', 'in', userIds)
      .execute(),
  });
  const baseline = await owned();
  const kept = new Set([...baseline.transactions, ...baseline.tags].map((row) => row.id));

  return async () => {
    const now = await owned();
    const added = (rows: Array<{ id: string }>) =>
      rows.map((row) => row.id).filter((id) => !kept.has(id));
    const transactionIds = added(now.transactions);
    const tagIds = added(now.tags);
    if (transactionIds.length > 0) {
      await db.deleteFrom('app.tagAssignments').where('entityId', 'in', transactionIds).execute();
      await removeTransactions(...transactionIds);
    }
    // Assignments cascade with their tag.
    if (tagIds.length > 0) await db.deleteFrom('app.tags').where('id', 'in', tagIds).execute();
  };
}

/** Soft-removes a tag's assignments as of `removedAt`, the way an untag leaves them. */
export async function removeTagAssignments(tagId: string, removedAt: string): Promise<void> {
  await db
    .updateTable('app.tagAssignments')
    .set({ removedAt })
    .where('tagId', '=', tagId)
    .execute();
}

export function seedBudget(input: Insertable<AppFinanceBudgets>) {
  return db.insertInto('app.financeBudgets').values(input).returningAll().executeTakeFirstOrThrow();
}

export async function seedMonthlyBudgets(rows: Insertable<AppFinanceMonthlyBudgets>[]) {
  await db.insertInto('app.financeMonthlyBudgets').values(rows).execute();
}

export function seedBill(input: Insertable<AppFinanceBills>) {
  return db.insertInto('app.financeBills').values(input).returningAll().executeTakeFirstOrThrow();
}

/** Empties these users' ledgers between cases. Users, accounts and categories stay put. */
export async function clearLedger(...userIds: string[]): Promise<void> {
  await db.deleteFrom('app.financeBillBalanceEntries').where('userId', 'in', userIds).execute();
  await db.deleteFrom('app.financeBills').where('userId', 'in', userIds).execute();
  await removeBudgets(...userIds);
  await db.deleteFrom('app.financeTransactions').where('userId', 'in', userIds).execute();
  await db.deleteFrom('app.tags').where('ownerUserid', 'in', userIds).execute();
}

/** Puts users back to having no profile, so no primary currency either. */
export async function removeProfiles(...userIds: string[]): Promise<void> {
  await db.deleteFrom('app.userProfiles').where('userId', 'in', userIds).execute();
}

export async function removeCategoryTransactions(
  userId: string,
  categoryId: string,
): Promise<void> {
  await db
    .deleteFrom('app.financeTransactions')
    .where('userId', '=', userId)
    .where('categoryId', '=', categoryId)
    .execute();
}

export async function seedBills(rows: Insertable<AppFinanceBills>[]) {
  const created = await db.insertInto('app.financeBills').values(rows).returning('id').execute();
  return created.map((row) => row.id);
}

export function seedRunwayPreferences(input: Insertable<AppFinanceRunwayPreferences>) {
  return db.insertInto('app.financeRunwayPreferences').values(input).execute();
}

/** Forces columns into states no production write allows, e.g. to simulate drift. */
export async function patchTransactions(
  ids: string[],
  patch: Updateable<AppFinanceTransactions>,
): Promise<void> {
  await db.updateTable('app.financeTransactions').set(patch).where('id', 'in', ids).execute();
}

export async function removeTransactions(...ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.deleteFrom('app.financeTransactions').where('id', 'in', ids).execute();
}

export async function removeBills(...ids: string[]): Promise<void> {
  await db.deleteFrom('app.financeBills').where('id', 'in', ids).execute();
}

export async function removeBudgets(...userIds: string[]): Promise<void> {
  await db.deleteFrom('app.financeBudgets').where('userId', 'in', userIds).execute();
}
