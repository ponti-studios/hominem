import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { AppTags, Selectable } from '@hominem/db';
import { sql } from 'kysely';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { getAffectedRows, tableExists, toNumber } from './utils';

export async function getSpendingCategories(ownerId: string): Promise<Selectable<AppTags>[]> {
  return db
    .selectFrom('app.tags')
    .selectAll()
    .where('ownerUserid', '=', ownerId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export const getTransactionTags = getSpendingCategories;

export async function createBudgetCategory(
  input: Partial<Selectable<AppTags>> & { ownerUserid: string; name: string },
): Promise<Selectable<AppTags>> {
  const id = input.id ?? crypto.randomUUID();
  const result = await db
    .insertInto('app.tags')
    .values({
      id,
      ownerUserid: input.ownerUserid,
      name: input.name,
      color: input.color ?? null,
      description: input.description ?? null,
      slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      path: input.path ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
    })
    .returningAll()
    .executeTakeFirst();
  if (!result) {
    throw new Error('Failed to create budget category');
  }
  return result;
}

export async function updateBudgetCategory(
  id: string,
  ownerUserid: string,
  input: Partial<Selectable<AppTags>>,
): Promise<Selectable<AppTags> | null> {
  const existing = await db
    .selectFrom('app.tags')
    .selectAll()
    .where('id', '=', id)
    .where('ownerUserid', '=', ownerUserid)
    .limit(1)
    .executeTakeFirst();
  if (!existing) {
    return null;
  }

  const result = await db
    .updateTable('app.tags')
    .set({
      name: input.name ?? existing.name,
      color: input.color === undefined ? existing.color : input.color,
    })
    .where('id', '=', id)
    .where('ownerUserid', '=', ownerUserid)
    .returningAll()
    .executeTakeFirst();
  return result ?? null;
}

export async function deleteBudgetCategory(id: string, ownerUserid: string): Promise<boolean> {
  const result = await db
    .deleteFrom('app.tags')
    .where('id', '=', id)
    .where('ownerUserid', '=', ownerUserid)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function getBudgetCategoryById(
  id: string,
  ownerUserid: string,
): Promise<Selectable<AppTags> | null> {
  const result = await db
    .selectFrom('app.tags')
    .selectAll()
    .where('id', '=', id)
    .where('ownerUserid', '=', ownerUserid)
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function checkBudgetCategoryNameExists(
  ownerUserid: string,
  name: string,
): Promise<boolean> {
  const result = await db
    .selectFrom('app.tags')
    .select('id')
    .where('ownerUserid', '=', ownerUserid)
    .where('name', '=', name)
    .limit(1)
    .executeTakeFirst();
  return !!result;
}

export const getUserExpenseCategories = getAllBudgetCategories;

export async function getAllBudgetCategories(
  ownerUserid: string,
): Promise<Selectable<AppTags>[]> {
  return db
    .selectFrom('app.tags')
    .selectAll()
    .where('ownerUserid', '=', ownerUserid)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export async function getBudgetCategoriesWithSpending(
  ownerUserid: string,
): Promise<
  Array<{
    id: string;
    ownerUserid: string;
    name: string;
    color: string | null;
    spent: number;
  }>
> {
  const result = await db
    .selectFrom('app.tags as tg')
    .leftJoin('app.tagAssignments as ti', (join) =>
      join
        .onRef('ti.tagId', '=', 'tg.id')
        .on('ti.entityTable', '=', sql`${FINANCE_TRANSACTION_ENTITY_TYPE}::regclass`),
    )
    .leftJoin('app.financeTransactions as t', (join) =>
      join
        .onRef('t.id', '=', 'ti.entityId')
        .onRef('t.userId', '=', 'tg.ownerUserid')
        .on('t.transactionType', '=', 'debit'),
    )
    .select([
      'tg.id',
      'tg.ownerUserid',
      'tg.name',
      'tg.color',
      sql<number>`coalesce(sum(abs(t.amount)), 0)`.as('spent'),
    ])
    .where('tg.ownerUserid', '=', ownerUserid)
    .groupBy(['tg.id', 'tg.ownerUserid', 'tg.name', 'tg.color'])
    .orderBy('tg.name', 'asc')
    .orderBy('tg.id', 'asc')
    .execute();

  return result.map((row) => ({
    id: row.id,
    ownerUserid: row.ownerUserid,
    name: row.name,
    color: row.color,
    spent: toNumber(row.spent),
  }));
}

export async function getBudgetTrackingData(
  ownerUserid: string,
): Promise<{ totalBudget: number; totalSpent: number }> {
  const spentResult = await db
    .selectFrom('app.financeTransactions')
    .select(sql<number>`coalesce(sum(abs(amount)), 0)`.as('totalSpent'))
    .where('userId', '=', ownerUserid)
    .where('transactionType', '=', 'debit')
    .executeTakeFirst();
  const totalSpent = spentResult ? toNumber(spentResult.totalSpent) : 0;

  const hasBudgetGoals = await tableExists('budget_goals');
  if (!hasBudgetGoals) {
    return { totalBudget: 0, totalSpent };
  }

  const budgetResult = await db
    .selectFrom('budget_goals' as any)
    .select(sql<number>`coalesce(sum(target_amount), 0)`.as('totalBudget'))
    .where('userId', '=', ownerUserid)
    .executeTakeFirst();
  return {
    totalBudget: budgetResult ? toNumber(budgetResult.totalBudget) : 0,
    totalSpent,
  };
}

export async function bulkCreateBudgetCategoriesFromTransactions(
  _ownerUserid: string,
): Promise<Selectable<AppTags>[]> {
  // The category column no longer exists; tags are the canonical categorization system.
  return [];
}
