import { randomUUID } from 'crypto';

import { db } from '@hominem/db/core';
import { replaceTransactionTags } from '@hominem/finance-services/transactions';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  FINANCE_TRANSACTION_PAGE_DEFAULT_LIMIT,
  FINANCE_TRANSACTION_PAGE_MAX_LIMIT,
} from '../../application/finance.pagination';
import { searchTransactions } from '../../application/finance.service';
import {
  listFinanceTransactionOptions,
  pairFinanceTransfers,
  unlinkFinanceTransfer,
  updateFinanceTransactions,
} from '../../application/finance.transactions-management.service';
import { NotFoundError, ValidationError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

const transactionListSchema = z
  .object({
    accountId: z.string().uuid().optional(),
    accountIds: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
    transactionIds: z.array(z.string().uuid()).max(5000).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    categoryName: z.string().min(1).optional(),
    uncategorizedOnly: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    transactionType: z.enum(['income', 'expense', 'transfer']).optional(),
    excluded: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(FINANCE_TRANSACTION_PAGE_MAX_LIMIT)
      .default(FINANCE_TRANSACTION_PAGE_DEFAULT_LIMIT),
    cursor: z
      .string()
      .min(1)
      .max(512)
      .optional()
      .describe('The `nextCursor` from the previous page.'),
    tagIds: z
      .union([z.string().uuid(), z.array(z.string().uuid())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
    tagNames: z
      .union([z.string().min(1), z.array(z.string().min(1))])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .optional(),
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
    categoryId: z.string().uuid().nullable().optional(),
    date: z.string().optional(),
    merchantName: z.string().nullable().optional(),
    tagIds: z.array(z.string().uuid()).optional(),
    notes: z.string().nullable().optional(),
    excluded: z.boolean().optional(),
  }),
});

const transactionBatchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(5000),
  action: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('category'),
      categoryId: z.string().uuid(),
      tagIds: z.array(z.string().uuid()).optional(),
    }),
    z.object({ action: z.literal('tags'), tagIds: z.array(z.string().uuid()) }),
    z.object({ action: z.literal('merchant'), value: z.string().max(200).nullable() }),
    z.object({ action: z.literal('notes'), value: z.string().max(2000).nullable() }),
    z.object({ action: z.literal('exclude') }),
    z.object({ action: z.literal('restore') }),
    z.object({ action: z.literal('move'), accountId: z.string().uuid() }),
    z.object({ action: z.literal('delete') }),
  ]),
});
const transferPairSchema = z.object({ ids: z.array(z.string().uuid()).length(2) });
const transferUnlinkSchema = z.object({ id: z.string().uuid() });

export const transactionsRoutes = new Hono<AppContext>()
  .get('/options', authMiddleware, async (c) =>
    c.json(await listFinanceTransactionOptions(c.get('auth')!.userId)),
  )
  .get('/list', authMiddleware, zValidator('query', transactionListSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('query');
    const accountId = input.accountId ?? input.account;
    const result = await searchTransactions(userId, {
      accountIds: input.accountIds?.length ? input.accountIds : accountId ? [accountId] : [],
      transactionIds: input.transactionIds,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      categoryName: input.categoryName,
      uncategorizedOnly: input.uncategorizedOnly,
      transactionType: input.transactionType,
      excluded: input.excluded,
      text: input.description,
      ...(input.search && !input.description ? { text: input.search } : {}),
      ...(input.min !== undefined && Number.isFinite(Number(input.min))
        ? { amountMin: Number(input.min) }
        : {}),
      ...(input.max !== undefined && Number.isFinite(Number(input.max))
        ? { amountMax: Number(input.max) }
        : {}),
      tagIds: input.tagIds,
      tagNames: input.tagNames,
      limit: input.limit,
      cursor: input.cursor,
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
          currencyCode: row.currencyCode,
          accountName: row.accountName,
          transactionType: row.transactionType,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          tags: row.tags,
          notes: row.notes,
          counterpartId: row.counterpartId,
          recurring: row.recurring,
          pending: row.pending,
          excluded: row.excluded,
          source: row.source,
        })),
        filteredCount: result.filteredCount,
        totalUserCount: result.totalUserCount,
        nextCursor: result.nextCursor,
      },
      200,
    );
  })
  .post('/create', authMiddleware, zValidator('json', transactionCreateSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('json');
    const id = randomUUID();
    const transactionType = input.amount < 0 ? 'debit' : 'credit';

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
        currencyCode: created.currencyCode,
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

    if (input.data.categoryId) {
      const category = await db
        .selectFrom('app.financeCategories')
        .select('id')
        .where('id', '=', input.data.categoryId)
        .where('userId', '=', userId)
        .executeTakeFirst();
      if (!category) throw new NotFoundError('Category not found');
    }
    if (input.data.accountId && input.data.accountId !== existing.accountId) {
      const account = await db
        .selectFrom('app.financeAccounts')
        .select(['id', 'currencyCode', 'allowedCurrencies'])
        .where('id', '=', input.data.accountId)
        .where('userId', '=', userId)
        .executeTakeFirst();
      if (!account) throw new NotFoundError('Account not found');
      if (
        ![account.currencyCode, ...account.allowedCurrencies].some(
          (code) => code.toUpperCase() === existing.currencyCode.toUpperCase(),
        )
      ) {
        throw new ValidationError('Account currency mismatch');
      }
      if (existing.counterpartId) {
        const counterpart = await db
          .selectFrom('app.financeTransactions')
          .select('accountId')
          .where('userId', '=', userId)
          .where('id', '=', existing.counterpartId)
          .executeTakeFirst();
        if (counterpart?.accountId === account.id)
          throw new ValidationError('Transfer accounts must remain different');
      }
    }

    const amount =
      input.data.amount !== undefined
        ? typeof input.data.amount === 'string'
          ? Number.parseFloat(input.data.amount)
          : input.data.amount
        : Number(existing.amount);
    const nextType = amount < 0 ? 'debit' : 'credit';

    const updated = await db
      .updateTable('app.financeTransactions')
      .set({
        amount,
        transactionType: nextType,
        ...(input.data.description !== undefined ? { description: input.data.description } : {}),
        ...(input.data.date !== undefined ? { postedOn: input.data.date } : {}),
        ...(input.data.accountId !== undefined ? { accountId: input.data.accountId } : {}),
        ...(input.data.merchantName !== undefined ? { merchantName: input.data.merchantName } : {}),
        ...(input.data.notes !== undefined ? { notes: input.data.notes } : {}),
        ...(input.data.excluded !== undefined ? { excluded: input.data.excluded } : {}),
        ...(input.data.categoryId !== undefined ? { categoryId: input.data.categoryId } : {}),
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
      currencyCode: updated!.currencyCode,
    });
  })
  .post('/batch', authMiddleware, zValidator('json', transactionBatchSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const { ids, action } = c.req.valid('json');
    return c.json(await updateFinanceTransactions(userId, ids, action));
  })
  .post('/transfer/pair', authMiddleware, zValidator('json', transferPairSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await pairFinanceTransfers(userId, c.req.valid('json').ids));
  })
  .post('/transfer/unlink', authMiddleware, zValidator('json', transferUnlinkSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    return c.json(await unlinkFinanceTransfer(userId, c.req.valid('json').id));
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
