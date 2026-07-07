import crypto from 'node:crypto';

import type { FinanceTransactions, Selectable } from '@hominem/db';
import { db } from '@hominem/db';
import { sql } from 'kysely';
import z from 'zod';

import { FINANCE_TRANSACTION_ENTITY_TYPE } from './contracts';
import { getAffectedRows, sqlValueList, toNumber } from './utils';

type TransactionRow = Selectable<FinanceTransactions>;

export const financeTransactionQueryContractSchema = z.object({
  userId: z.uuid(),
  accountId: z.uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
  tagIds: z.array(z.uuid()).optional(),
  tagNames: z.array(z.string().min(1)).optional(),
});

export type FinanceTransactionQueryContract = z.infer<typeof financeTransactionQueryContractSchema>;

export async function queryTransactions(user_id: string): Promise<TransactionRow[]> {
  return queryTransactionsByContract({ user_id });
}

export async function queryTransactionsByContract(input: {
  user_id: string;
  account_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  tag_ids?: string[];
  tag_names?: string[];
}): Promise<TransactionRow[]> {
  const parsed = financeTransactionQueryContractSchema.parse({
    userId: input.user_id,
    accountId: input.account_id,
    dateFrom: input.date_from,
    dateTo: input.date_to,
    limit: input.limit ?? 50,
    offset: input.offset ?? 0,
    tagIds: input.tag_ids,
    tagNames: input.tag_names,
  });

  const tagIds = parsed.tagIds ?? [];
  const tagNames = parsed.tagNames ?? [];
  let query = db
    .selectFrom('finance_transactions as t')
    .selectAll()
    .where('t.user_id', '=', parsed.userId);

  if (parsed.accountId) {
    query = query.where('t.account_id', '=', parsed.accountId);
  }
  if (parsed.dateFrom) {
    query = query.where('t.date', '>=', new Date(parsed.dateFrom));
  }
  if (parsed.dateTo) {
    query = query.where('t.date', '<=', new Date(parsed.dateTo));
  }
  if (tagIds.length > 0 && tagNames.length > 0) {
    query = query.where(
      sql<boolean>`exists (
        select 1
        from tagged_items ti_filter
        join tags tg_filter
          on tg_filter.id = ti_filter.tag_id
         and tg_filter.owner_id = ${parsed.userId}
        where ti_filter.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE}
          and ti_filter.entity_id = t.id
          and (
            ti_filter.tag_id in (${sqlValueList(tagIds)})
            or tg_filter.name in (${sqlValueList(tagNames)})
          )
      )`,
    );
  } else if (tagIds.length > 0) {
    query = query.where(
      sql<boolean>`exists (
        select 1
        from tagged_items ti_filter
        join tags tg_filter
          on tg_filter.id = ti_filter.tag_id
         and tg_filter.owner_id = ${parsed.userId}
        where ti_filter.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE}
          and ti_filter.entity_id = t.id
          and ti_filter.tag_id in (${sqlValueList(tagIds)})
      )`,
    );
  } else if (tagNames.length > 0) {
    query = query.where(
      sql<boolean>`exists (
        select 1
        from tagged_items ti_filter
        join tags tg_filter
          on tg_filter.id = ti_filter.tag_id
         and tg_filter.owner_id = ${parsed.userId}
        where ti_filter.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE}
          and ti_filter.entity_id = t.id
          and tg_filter.name in (${sqlValueList(tagNames)})
      )`,
    );
  }

  const result = await query
    .orderBy('t.date', 'desc')
    .orderBy('t.id', 'desc')
    .limit(parsed.limit)
    .offset(parsed.offset)
    .execute();
  return result;
}

export async function replaceTransactionTags(
  transactionId: string,
  user_id: string,
  tagIds: string[],
): Promise<string[]> {
  const ownershipResult = await db
    .selectFrom('finance_transactions')
    .select('id')
    .where('id', '=', transactionId)
    .where('user_id', '=', user_id)
    .limit(1)
    .executeTakeFirst();
  if (!ownershipResult) {
    return [];
  }

  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length > 0) {
    const validTagResult = await db
      .selectFrom('tags')
      .select('id')
      .where('owner_id', '=', user_id)
      .where(sql<boolean>`id in (${sqlValueList(uniqueTagIds)})`)
      .execute();
    const validIds = new Set((validTagResult as Array<{ id: string }>).map((row) => row.id));
    if (validIds.size !== uniqueTagIds.length) {
      throw new Error('One or more tags are invalid for this user');
    }
  }

  await db
    .deleteFrom('tagged_items')
    .where('entity_type', '=', FINANCE_TRANSACTION_ENTITY_TYPE)
    .where('entity_id', '=', transactionId)
    .execute();

  for (const tagId of uniqueTagIds) {
    await db
      .insertInto('tagged_items')
      .values({
        id: crypto.randomUUID(),
        tag_id: tagId,
        entity_type: FINANCE_TRANSACTION_ENTITY_TYPE,
        entity_id: transactionId,
      })
      .execute();
  }

  return uniqueTagIds;
}

export async function getTransactionTagIds(
  transactionId: string,
  user_id: string,
): Promise<string[]> {
  const result = await db
    .selectFrom('tagged_items as ti')
    .innerJoin('tags as tg', (join) =>
      join.onRef('tg.id', '=', 'ti.tag_id').on('tg.owner_id', '=', user_id),
    )
    .select('ti.tag_id')
    .where('ti.entity_type', '=', FINANCE_TRANSACTION_ENTITY_TYPE)
    .where('ti.entity_id', '=', transactionId)
    .orderBy('ti.tag_id', 'asc')
    .execute();
  return (result as Array<{ tag_id: string }>).map((row) => row.tag_id);
}

export async function createTransaction(
  input: Partial<TransactionRow> & { user_id: string; account_id: string; amount: number },
): Promise<TransactionRow> {
  const id = input.id ?? crypto.randomUUID();
  const transaction_type = input.amount < 0 ? 'expense' : 'income';

  const result = await db
    .insertInto('finance_transactions')
    .values({
      id,
      user_id: input.user_id,
      account_id: input.account_id,
      amount: input.amount,
      transaction_type,
      description: input.description ?? null,
      category: input.category ?? null,
      merchant_name: input.merchant_name ?? null,
      date: input.date ?? new Date(),
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Failed to create transaction');
  }
  return result;
}

export async function updateTransaction(
  id: string,
  user_id: string,
  input: Partial<
    Pick<
      TransactionRow,
      'amount' | 'description' | 'date' | 'account_id' | 'category' | 'merchant_name'
    >
  >,
): Promise<TransactionRow | null> {
  const existingResult = await db
    .selectFrom('finance_transactions')
    .selectAll()
    .where('id', '=', id)
    .where('user_id', '=', user_id)
    .limit(1)
    .executeTakeFirst();
  const existing = existingResult ?? null;
  if (!existing) {
    return null;
  }

  const nextAmount = input.amount ?? toNumber(existing.amount);
  const nextDescription =
    input.description === undefined ? existing.description : input.description;
  const nextDate = input.date ?? existing.date;
  const nextAccountId = input.account_id ?? existing.account_id;
  const nextCategory = input.category === undefined ? existing.category : input.category;
  const nextMerchantName =
    input.merchant_name === undefined ? existing.merchant_name : input.merchant_name;
  const nextType = nextAmount < 0 ? 'expense' : 'income';

  const updateResult = await db
    .updateTable('finance_transactions')
    .set({
      amount: nextAmount,
      description: nextDescription,
      date: nextDate,
      account_id: nextAccountId,
      category: nextCategory,
      merchant_name: nextMerchantName,
      transaction_type: nextType,
    })
    .where('id', '=', id)
    .where('user_id', '=', user_id)
    .returningAll()
    .executeTakeFirst();
  return updateResult ?? null;
}

export async function deleteTransaction(id: string, user_id?: string): Promise<boolean> {
  if (user_id) {
    const result = await db
      .deleteFrom('finance_transactions')
      .where('id', '=', id)
      .where('user_id', '=', user_id)
      .executeTakeFirst();
    return getAffectedRows(result) > 0;
  }

  const result = await db
    .deleteFrom('finance_transactions')
    .where('id', '=', id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function insertTransaction(input: {
  id?: string;
  user_id: string;
  account_id: string;
  amount: number | string;
  description: string | null;
  date: string | Date;
  merchant_name?: string | null;
  category?: string | null;
  pending?: boolean;
  source?: string | null;
  external_id?: string;
}): Promise<TransactionRow> {
  const amount = typeof input.amount === 'string' ? Number.parseFloat(input.amount) : input.amount;
  const date = input.date instanceof Date ? input.date.toISOString().slice(0, 10) : input.date;
  const transaction_type = amount < 0 ? 'expense' : 'income';
  const id = input.id ?? crypto.randomUUID();

  const result = await db
    .insertInto('finance_transactions')
    .values({
      id,
      user_id: input.user_id,
      account_id: input.account_id,
      amount,
      transaction_type,
      description: input.description,
      merchant_name: input.merchant_name ?? null,
      category: input.category ?? null,
      date,
      pending: input.pending ?? false,
      source: input.source ?? null,
      external_id: input.external_id ?? null,
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Failed to insert transaction');
  }
  return result;
}

export async function getTransactionByPlaidId(
  external_id: string,
  user_id?: string,
): Promise<TransactionRow | null> {
  if (user_id) {
    const result = await db
      .selectFrom('finance_transactions')
      .selectAll()
      .where('external_id', '=', external_id)
      .where('user_id', '=', user_id)
      .orderBy('date', 'desc')
      .orderBy('id', 'desc')
      .limit(1)
      .executeTakeFirst();
    return result ?? null;
  }

  const result = await db
    .selectFrom('finance_transactions')
    .selectAll()
    .where('external_id', '=', external_id)
    .orderBy('date', 'desc')
    .orderBy('id', 'desc')
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function processTransactionsFromCSVBuffer(_input: {
  user_id: string;
  account_id: string;
  csvBuffer: ArrayBuffer | Buffer;
}): Promise<{ imported: number; skipped: number }> {
  return { imported: 0, skipped: 0 };
}

export async function updatePlaidTransaction(
  id: string,
  updates: Partial<{
    amount: number | string;
    description: string | null;
    date: string | Date;
    merchant_name: string | null;
    category: string | null;
    pending: boolean;
  }>,
): Promise<TransactionRow | null> {
  const existingResult = await db
    .selectFrom('finance_transactions')
    .selectAll()
    .where('id', '=', id)
    .limit(1)
    .executeTakeFirst();
  const existing = existingResult ?? null;
  if (!existing) {
    return null;
  }

  const nextAmount =
    updates.amount === undefined
      ? toNumber(existing.amount)
      : typeof updates.amount === 'string'
        ? Number.parseFloat(updates.amount)
        : updates.amount;
  const nextDescription =
    updates.description === undefined ? existing.description : updates.description;
  const nextDate =
    updates.date === undefined
      ? existing.date
      : updates.date instanceof Date
        ? updates.date.toISOString().slice(0, 10)
        : updates.date;
  const nextCategory = updates.category === undefined ? existing.category : updates.category;
  const nextMerchantName =
    updates.merchant_name === undefined ? existing.merchant_name : updates.merchant_name;
  const nextType = nextAmount < 0 ? 'expense' : 'income';

  const result = await db
    .updateTable('finance_transactions')
    .set({
      amount: nextAmount,
      description: nextDescription,
      date: nextDate,
      category: nextCategory,
      merchant_name: nextMerchantName,
      transaction_type: nextType,
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst();
  return result ?? null;
}

export async function deletePlaidTransaction(external_id: string): Promise<boolean> {
  const result = await db
    .deleteFrom('finance_transactions')
    .where('external_id', '=', external_id)
    .executeTakeFirst();
  return !!result;
}

export async function queryAnalyticsTransactionsByContract(input: {
  user_id: string;
  account_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  tag_ids?: string[];
  tag_names?: string[];
}): Promise<
  Array<{
    id: string;
    user_id: string;
    account_id: string;
    amount: number;
    description: string | null;
    date: string | Date | null | undefined;
    external_id: string | null | undefined;
    category: string | null | undefined;
    merchant_name: string | null | undefined;
    classification: string;
  }>
> {
  const parsed = financeTransactionQueryContractSchema.parse({
    userId: input.user_id,
    accountId: input.account_id,
    dateFrom: input.date_from,
    dateTo: input.date_to,
    limit: input.limit ?? 200,
    offset: input.offset ?? 0,
    tagIds: input.tag_ids,
    tagNames: input.tag_names,
  });

  const tagIds = parsed.tagIds ?? [];
  const tagNames = parsed.tagNames ?? [];
  let query = db
    .selectFrom('finance_transactions as t')
    .select([
      't.id',
      't.user_id',
      't.account_id',
      't.amount',
      't.description',
      't.date',
      't.external_id',
      't.category',
      't.merchant_name',
      sql<string>`coalesce((select min(tg_tag.name) from tagged_items ti_tag join tags tg_tag on tg_tag.id = ti_tag.tag_id and tg_tag.owner_id = ${parsed.userId} where ti_tag.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE} and ti_tag.entity_id = t.id), t.category, ${sql.lit('Uncategorized')})`.as(
        'classification',
      ),
    ])
    .where('t.user_id', '=', parsed.userId);

  if (parsed.accountId) {
    query = query.where('t.account_id', '=', parsed.accountId);
  }
  if (parsed.dateFrom) {
    query = query.where('t.date', '>=', new Date(parsed.dateFrom));
  }
  if (parsed.dateTo) {
    query = query.where('t.date', '<=', new Date(parsed.dateTo));
  }

  if (tagIds.length > 0 && tagNames.length > 0) {
    query = query.where(
      sql<boolean>`exists (select 1 from tagged_items ti_filter join tags tg_filter on tg_filter.id = ti_filter.tag_id and tg_filter.owner_id = ${parsed.userId} where ti_filter.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE} and ti_filter.entity_id = t.id and (ti_filter.tag_id in (${sqlValueList(tagIds)}) or tg_filter.name in (${sqlValueList(tagNames)})))`,
    );
  } else if (tagIds.length > 0) {
    query = query.where(
      sql<boolean>`exists (select 1 from tagged_items ti_filter join tags tg_filter on tg_filter.id = ti_filter.tag_id and tg_filter.owner_id = ${parsed.userId} where ti_filter.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE} and ti_filter.entity_id = t.id and ti_filter.tag_id in (${sqlValueList(tagIds)}))`,
    );
  } else if (tagNames.length > 0) {
    query = query.where(
      sql<boolean>`exists (select 1 from tagged_items ti_filter join tags tg_filter on tg_filter.id = ti_filter.tag_id and tg_filter.owner_id = ${parsed.userId} where ti_filter.entity_type = ${FINANCE_TRANSACTION_ENTITY_TYPE} and ti_filter.entity_id = t.id and tg_filter.name in (${sqlValueList(tagNames)}))`,
    );
  }

  const result = await query
    .orderBy('t.date', 'desc')
    .orderBy('t.id', 'desc')
    .limit(parsed.limit)
    .offset(parsed.offset)
    .execute();

  return result.map((row) => ({
    ...row,
    amount: toNumber(row.amount),
  }));
}
