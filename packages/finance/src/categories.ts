import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { Selectable, Tags } from '@hominem/db';
import { sql } from 'kysely';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { getAffectedRows, tableExists, toNumber } from './utils';

export async function getSpendingCategories(owner_id: string): Promise<Selectable<Tags>[]> {
  const result = await db
    .selectFrom('tags')
    .selectAll()
    .where('owner_id', '=', owner_id)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export const getTransactionTags = getSpendingCategories;

export async function createBudgetCategory(
  input: Partial<Selectable<Tags>> & { owner_id: string; name: string },
): Promise<Selectable<Tags>> {
  const id = input.id ?? crypto.randomUUID();
  const result = await db
    .insertInto('tags')
    .values({
      id,
      owner_id: input.owner_id,
      name: input.name,
      color: input.color ?? null,
      description: input.description ?? null,
    })
    .returningAll()
    .executeTakeFirst();
  const row = result ?? null;
  if (!row) {
    throw new Error('Failed to create budget category');
  }
  return row;
}

export async function updateBudgetCategory(
  id: string,
  owner_id: string,
  input: Partial<Selectable<Tags>>,
): Promise<Selectable<Tags> | null> {
  const existingResult = await db
    .selectFrom('tags')
    .selectAll()
    .where('id', '=', id)
    .where('owner_id', '=', owner_id)
    .limit(1)
    .executeTakeFirst();
  const existing = existingResult ?? null;
  if (!existing) {
    return null;
  }

  const result = await db
    .updateTable('tags')
    .set({
      name: input.name ?? existing.name,
      color: input.color === undefined ? existing.color : input.color,
    })
    .where('id', '=', id)
    .where('owner_id', '=', owner_id)
    .returningAll()
    .executeTakeFirst();
  return result ?? null;
}

export async function deleteBudgetCategory(id: string, owner_id: string): Promise<boolean> {
  const result = await db
    .deleteFrom('tags')
    .where('id', '=', id)
    .where('owner_id', '=', owner_id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function getBudgetCategoryById(
  id: string,
  owner_id: string,
): Promise<Selectable<Tags> | null> {
  const result = await db
    .selectFrom('tags')
    .selectAll()
    .where('id', '=', id)
    .where('owner_id', '=', owner_id)
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function checkBudgetCategoryNameExists(
  owner_id: string,
  name: string,
): Promise<boolean> {
  const result = await db
    .selectFrom('tags')
    .select('id')
    .where('owner_id', '=', owner_id)
    .where('name', '=', name)
    .limit(1)
    .executeTakeFirst();
  return !!result;
}

export const getUserExpenseCategories = getAllBudgetCategories;

export async function getAllBudgetCategories(owner_id: string): Promise<Selectable<Tags>[]> {
  const result = await db
    .selectFrom('tags')
    .selectAll()
    .where('owner_id', '=', owner_id)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export async function getBudgetCategoriesWithSpending(
  owner_id: string,
): Promise<
  Array<{ id: string; owner_id: string; name: string; color: string | null; spent: number }>
> {
  const result = await db
    .selectFrom('tags as tg')
    .leftJoin('tagged_items as ti', (join) =>
      join
        .onRef('ti.tag_id', '=', 'tg.id')
        .on('ti.entity_type', '=', FINANCE_TRANSACTION_ENTITY_TYPE),
    )
    .leftJoin('finance_transactions as t', (join) =>
      join
        .onRef('t.id', '=', 'ti.entity_id')
        .onRef('t.user_id', '=', 'tg.owner_id')
        .on('t.transaction_type', '=', 'expense'),
    )
    .select([
      'tg.id',
      'tg.owner_id',
      'tg.name',
      'tg.color',
      sql<number>`coalesce(sum(abs(t.amount)), 0)`.as('spent'),
    ])
    .where('tg.owner_id', '=', owner_id)
    .groupBy(['tg.id', 'tg.owner_id', 'tg.name', 'tg.color'])
    .orderBy('tg.name', 'asc')
    .orderBy('tg.id', 'asc')
    .execute();

  return result.map((row) => ({
    ...row,
    spent: toNumber(row.spent),
  }));
}

export async function getBudgetTrackingData(
  owner_id: string,
): Promise<{ totalBudget: number; totalSpent: number }> {
  const spentResult = await db
    .selectFrom('finance_transactions')
    .select(sql<number>`coalesce(sum(abs(amount)), 0)`.as('total_spent'))
    .where('user_id', '=', owner_id)
    .where('transaction_type', '=', 'expense')
    .executeTakeFirst();
  const totalSpent = spentResult ? toNumber(spentResult.total_spent) : 0;

  const hasBudgetGoals = await tableExists('budget_goals');
  if (!hasBudgetGoals) {
    return { totalBudget: 0, totalSpent };
  }

  const budgetResult = await db
    .selectFrom('budget_goals')
    .select(sql<number>`coalesce(sum(target_amount), 0)`.as('total_budget'))
    .where('user_id', '=', owner_id)
    .executeTakeFirst();
  return {
    totalBudget: budgetResult ? toNumber(budgetResult.total_budget) : 0,
    totalSpent,
  };
}

export async function bulkCreateBudgetCategoriesFromTransactions(
  owner_id: string,
): Promise<Selectable<Tags>[]> {
  const txCategoryResult = await db
    .selectFrom('finance_transactions')
    .select('category')
    .distinct()
    .where('user_id', '=', owner_id)
    .where('category', 'is not', null)
    .where(sql<boolean>`category <> ''`)
    .orderBy('category', 'asc')
    .execute();
  const discovered = (txCategoryResult as Array<{ category: string }>)
    .map((row) => row.category)
    .filter((c) => c !== null) as string[];
  if (discovered.length === 0) {
    return [];
  }

  const existingResult = await db
    .selectFrom('tags')
    .select('name')
    .where('owner_id', '=', owner_id)
    .execute();
  const existingNames = new Set(
    (existingResult as Array<{ name: string }>).map((row) => row.name.toLowerCase()),
  );

  const toCreate = discovered.filter((name) => !existingNames.has(name.toLowerCase()));
  if (toCreate.length === 0) {
    return [];
  }

  const created: Selectable<Tags>[] = [];
  for (const name of toCreate) {
    const category = await createBudgetCategory({
      owner_id,
      name,
    });
    created.push(category);
  }
  return created;
}
