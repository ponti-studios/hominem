// Read-backs that assertions need and no production service exposes in this shape.
import { db, sql } from '@hominem/db/core';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from '../contracts';

/** Integer cents per currency, which is how the totals invariant is stated. */
export async function currencyTotals(userId: string, categoryIds: string[]) {
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select(['currencyCode'])
    .select((eb) => eb.fn.sum<string>('amount').as('total'))
    .where('userId', '=', userId)
    .where('categoryId', 'in', categoryIds)
    .groupBy('currencyCode')
    .orderBy('currencyCode', 'asc')
    .execute();
  return rows.map((row) => ({
    currencyCode: row.currencyCode,
    cents: Math.round(Number(row.total) * 100),
  }));
}

export async function transactionIdsInCategory(
  userId: string,
  categoryId: string,
): Promise<string[]> {
  const rows = await db
    .selectFrom('app.financeTransactions')
    .select('id')
    .where('userId', '=', userId)
    .where('categoryId', '=', categoryId)
    .execute();
  return rows.map((row) => row.id).sort();
}

export function categoryByName(userId: string, name: string) {
  return db
    .selectFrom('app.financeCategories')
    .select(['id', 'name'])
    .where('userId', '=', userId)
    .where(sql<boolean>`lower(name) = lower(${name})`)
    .executeTakeFirst();
}

export async function tagNamesOnTransaction(
  userId: string,
  transactionId: string,
): Promise<string[]> {
  const rows = await db
    .selectFrom('app.tagAssignments as ti')
    .innerJoin('app.tags as tg', 'tg.id', 'ti.tagId')
    .select('tg.name')
    .where('tg.ownerUserid', '=', userId)
    .where('ti.entityTable', '=', sql<string>`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`)
    .where('ti.entityId', '=', transactionId)
    .where('ti.removedAt', 'is', null)
    .execute();
  return rows.map((row) => row.name).sort();
}

export function tagById(id: string) {
  return db.selectFrom('app.tags').select(['id', 'name']).where('id', '=', id).executeTakeFirst();
}

export async function activeEntityIdsForTag(tagId: string): Promise<string[]> {
  const rows = await db
    .selectFrom('app.tagAssignments')
    .select('entityId')
    .where('tagId', '=', tagId)
    .where('removedAt', 'is', null)
    .execute();
  return rows.map((row) => row.entityId).sort();
}

export function transactionsByIds(ids: string[]) {
  return db
    .selectFrom('app.financeTransactions')
    .selectAll()
    .where('id', 'in', ids)
    .orderBy('id')
    .execute();
}

export function latestLiveRulebook(userId: string) {
  return db
    .selectFrom('app.financeRulingRulebooks')
    .select('contents')
    .where('userId', '=', userId)
    .where('source', '=', 'live')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .executeTakeFirst();
}

export function categoryById(id: string) {
  return db
    .selectFrom('app.financeCategories')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();
}

export function budgetRows(
  userId: string,
  filter: { budgetId?: string; categoryId?: string; tagId?: string } = {},
) {
  let query = db.selectFrom('app.financeBudgets').selectAll().where('userId', '=', userId);
  if (filter.budgetId) query = query.where('id', '=', filter.budgetId);
  if (filter.categoryId) query = query.where('categoryId', '=', filter.categoryId);
  if (filter.tagId) query = query.where('tagId', '=', filter.tagId);
  return query.execute();
}

export function accountById(id: string) {
  return db.selectFrom('app.financeAccounts').selectAll().where('id', '=', id).executeTakeFirst();
}
