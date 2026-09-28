import { randomUUID } from 'crypto';

import { db } from '@hominem/db/core';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { searchTransactions } from '../../application/finance.service';
import { NotFoundError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

const transactionListSchema = z
  .object({
    accountId: z.string().uuid().optional(),
    accountIds: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    tagIds: z.array(z.string().uuid()).optional(),
    tagNames: z.array(z.string().min(1)).optional(),
  })
  .extend({
    account: z.string().uuid().optional(),
    sortBy: z.string().optional(),
    sortDirection: z
      .enum(['asc', 'desc'])
      .or(z.array(z.enum(['asc', 'desc'])))
      .optional(),
    description: z.string().optional(),
    search: z.string().optional(),
    min: z.string().optional(),
    max: z.string().optional(),
  });

const transactionDeleteSchema = z.object({
  id: z.string().uuid(),
});

const transactionCreateSchema = z.object({
  accountId: z.string().uuid(),
  amount: z.number(),
  description: z.string().min(1),
  date: z.string(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

const transactionUpdateSchema = z.object({
  id: z.string().uuid(),
  data: z.object({
    accountId: z.string().uuid().optional(),
    amount: z.union([z.number(), z.string()]).optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    date: z.string().optional(),
    merchantName: z.string().nullable().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
  }),
});

async function replaceTransactionTags(
  transactionId: string,
  userId: string,
  tagIds: string[],
): Promise<void> {
  const tx = await db
    .selectFrom('app.financeTransactions')
    .select('id')
    .where('id', '=', transactionId)
    .where('userId', '=', userId)
    .executeTakeFirst();
  if (!tx) return;

  const uniqueTagIds = [...new Set(tagIds)];
  if (uniqueTagIds.length > 0) {
    const validTags = await db
      .selectFrom('app.tags')
      .select('id')
      .where('ownerUserid', '=', userId)
      .where('id', 'in', uniqueTagIds)
      .execute();
    if (validTags.length !== uniqueTagIds.length) {
      throw new Error('One or more tags are invalid for this user');
    }
  }

  await db
    .deleteFrom('app.tagAssignments')
    .where('entityTable', '=', 'app.financeTransactions')
    .where('entityId', '=', transactionId)
    .execute();

  for (const tagId of uniqueTagIds) {
    await db
      .insertInto('app.tagAssignments')
      .values({
        id: randomUUID(),
        tagId: tagId,
        entityTable: 'app.financeTransactions',
        entityId: transactionId,
      })
      .execute();
  }
}

export const transactionsRoutes = new Hono<AppContext>()
  .get('/list', authMiddleware, zValidator('query', transactionListSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('query');
    const accountId = input.accountId ?? input.account;
    const result = await searchTransactions(userId, {
      accountIds: input.accountIds?.length ? input.accountIds : accountId ? [accountId] : [],
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      text: input.description,
      tagIds: input.tagIds,
      tagNames: input.tagNames,
      limit: input.limit,
      offset: input.offset,
    });
    return c.json(
      {
        data: result.data.map((row) => ({
          id: row.id,
          userId: row.userId,
          accountId: row.accountId,
          amount: row.amount,
          description: row.description,
          postedOn: row.postedOn,
          merchantName: row.merchantName,
        })),
        filteredCount: result.filteredCount,
        totalUserCount: result.totalUserCount,
      },
      200,
    );
  })
  .post('/create', authMiddleware, zValidator('json', transactionCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');
    const id = randomUUID();
    const transactionType = input.amount < 0 ? 'expense' : 'income';

    await db
      .insertInto('app.financeTransactions')
      .values({
        id,
        userId: userId,
        accountId: input.accountId,
        amount: input.amount,
        transactionType: transactionType,
        description: input.description,
        merchantName: null,
        postedOn: input.date,
      })
      .execute();

    const created = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!created) throw new Error('Failed to create transaction');

    if (input.tagIds && input.tagIds.length > 0) {
      await replaceTransactionTags(id, userId, input.tagIds);
    }

    return c.json(
      {
        id: created.id,
        userId: created.userId,
        accountId: created.accountId,
        amount: created.amount ? Number(created.amount) : 0,
        description: created.description ?? null,
        postedOn: created.postedOn ? String(created.postedOn) : '',
        merchantName: created.merchantName ?? null,
      },
      201,
    );
  })
  .post('/update', authMiddleware, zValidator('json', transactionUpdateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');

    const existing = await db
      .selectFrom('app.financeTransactions')
      .selectAll()
      .where('id', '=', input.id)
      .where('userId', '=', userId)
      .executeTakeFirst();

    if (!existing) {
      throw new NotFoundError('Transaction not found');
    }

    const amount =
      input.data.amount !== undefined
        ? typeof input.data.amount === 'string'
          ? Number.parseFloat(input.data.amount)
          : input.data.amount
        : Number(existing.amount);
    const nextType = amount < 0 ? 'expense' : 'income';

    const updated = await db
      .updateTable('app.financeTransactions')
      .set({
        amount,
        transactionType: nextType,
        ...(input.data.description !== undefined ? { description: input.data.description } : {}),
        ...(input.data.date !== undefined ? { postedOn: input.data.date } : {}),
        ...(input.data.accountId !== undefined ? { accountId: input.data.accountId } : {}),
        ...(input.data.merchantName !== undefined ? { merchantName: input.data.merchantName } : {}),
      })
      .where('id', '=', input.id)
      .where('userId', '=', userId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      return c.notFound();
    }

    if (input.data.tagIds) {
      await replaceTransactionTags(updated.id, userId, input.data.tagIds);
    }

    return c.json({
      id: updated!.id,
      userId: updated!.userId,
      accountId: updated!.accountId,
      amount: updated!.amount ? Number(updated!.amount) : 0,
      description: updated!.description ?? null,
      postedOn: updated!.postedOn ? String(updated!.postedOn) : '',
      merchantName: updated!.merchantName ?? null,
    });
  })
  .post('/delete', authMiddleware, zValidator('json', transactionDeleteSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');

    const result = await db
      .deleteFrom('app.financeTransactions')
      .where('id', '=', input.id)
      .where('userId', '=', userId)
      .returningAll()
      .executeTakeFirst();

    const deleted = Boolean(result);
    return c.json({
      success: deleted,
      ...(deleted ? {} : { message: 'Transaction not found' }),
    });
  });
