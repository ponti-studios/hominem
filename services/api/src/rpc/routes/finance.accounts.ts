import { randomUUID } from 'crypto';

import { db } from '@hominem/db';
import type {
  AccountAllOutput,
  AccountCreateOutput,
  AccountDeleteOutput,
  AccountGetOutput,
  AccountInstitutionAccountsOutput,
  AccountListOutput,
  AccountUpdateOutput,
  AccountsWithPlaidOutput,
} from '@hominem/rpc/finance';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { NotFoundError } from '../errors';
import type { AppContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';

const accountListSchema = z.object({
  includeInactive: z.coerce.boolean().optional().default(false),
});

const accountGetSchema = z.object({
  id: z.string().uuid(),
});

const accountCreateSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1).optional(),
  balance: z.union([z.number(), z.string()]).optional(),
  institutionId: z.string().optional(),
  institution: z.string().optional(),
});

const accountUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  type: z.string().min(1).optional(),
  balance: z.union([z.number(), z.string()]).optional(),
  institutionId: z.string().optional(),
  institution: z.string().optional(),
});

const accountDeleteSchema = z.object({
  id: z.string().uuid(),
});

const institutionAccountsSchema = z.object({
  institutionId: z.string(),
});

// Helper to get account with ownership check
async function getAccountWithOwnershipCheck(accountId: string, userId: string) {
  const account = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where((eb) => eb.and([eb('id', '=', accountId), eb('userId', '=', userId)]))
    .executeTakeFirst();

  if (!account) {
    throw new NotFoundError('Account not found');
  }
  return account;
}

// Helper to get transactions for an account
async function getTransactionsForAccount(
  accountId: string,
  limit: number = 200,
  offset: number = 0,
) {
  return db
    .selectFrom('app.financeTransactions')
    .selectAll()
    .where('accountId', '=', accountId)
    .orderBy('postedOn', 'desc')
    .limit(limit)
    .offset(offset)
    .execute();
}

export const accountsRoutes = new Hono<AppContext>()
  .get('/list', authMiddleware, zValidator('query', accountListSchema), async (c) => {
    const userId = c.get('userId')!;
    const accounts = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .execute();
    return c.json<AccountListOutput>(
      accounts.map((a) => ({
        id: String(a.id),
        userId: a.userId,
        name: a.name,
        accountType: a.accountType,
        currentBalance: a.currentBalance ? Number(a.currentBalance) : null,
      })),
      200,
    );
  })
  .get('/get', authMiddleware, zValidator('query', accountGetSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('query');
    const account = await getAccountWithOwnershipCheck(input.id, userId);
    const transactions = await getTransactionsForAccount(input.id, 200, 0);
    return c.json<AccountGetOutput>({
      id: String(account.id),
      userId: account.userId,
      name: account.name,
      accountType: account.accountType,
      currentBalance: account.currentBalance ? Number(account.currentBalance) : null,
      plaidItemId: null,
      transactions: transactions.map((t) => ({
        id: String(t.id),
        userId: t.userId,
        accountId: String(t.accountId),
        amount: t.amount ? Number(t.amount) : 0,
        description: t.description ?? null,
        postedOn: t.postedOn ? String(t.postedOn) : '',
        merchantName: t.merchantName ?? null,
      })),
    });
  })
  .post('/create', authMiddleware, zValidator('json', accountCreateSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const accountId = randomUUID();
    const now = new Date().toISOString();

    await db
      .insertInto('app.financeAccounts')
      .values({
        id: accountId,
        userId: userId,
        name: input.name,
        accountType: input.type ?? 'other',
        currentBalance: input.balance === undefined ? null : Number(input.balance),
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    const created = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('id', '=', accountId)
      .executeTakeFirst();

    if (!created) throw new NotFoundError('Account not found after creation');
    return c.json<AccountCreateOutput>(
      {
        id: String(created.id),
        userId: created.userId,
        name: created.name,
        accountType: created.accountType,
        currentBalance: created.currentBalance ? Number(created.currentBalance) : null,
      },
      201,
    );
  })
  .post('/update', authMiddleware, zValidator('json', accountUpdateSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');

    await getAccountWithOwnershipCheck(input.id, userId);

    const now = new Date().toISOString();
    const updateValues: Record<string, unknown> = { updatedAt: now };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.type !== undefined) updateValues.accountType = input.type;
    if (input.balance !== undefined) updateValues.currentBalance = Number(input.balance);

    await db
      .updateTable('app.financeAccounts')
      .set(updateValues)
      .where('id', '=', input.id)
      .execute();

    const updated = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('id', '=', input.id)
      .executeTakeFirst();

    if (!updated) throw new NotFoundError('Account not found after update');
    return c.json<AccountUpdateOutput>(
      {
        id: String(updated.id),
        userId: updated.userId,
        name: updated.name,
        accountType: updated.accountType,
        currentBalance: updated.currentBalance ? Number(updated.currentBalance) : null,
      },
      200,
    );
  })
  .post('/delete', authMiddleware, zValidator('json', accountDeleteSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');

    await getAccountWithOwnershipCheck(input.id, userId);

    await db.deleteFrom('app.financeTransactions').where('accountId', '=', input.id).execute();
    await db.deleteFrom('app.financeAccounts').where('id', '=', input.id).execute();

    return c.json<AccountDeleteOutput>({ success: true }, 200);
  })
  .get('/with-plaid', authMiddleware, async (c) => {
    const userId = c.get('userId')!;
    const accounts = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .execute();

    return c.json<AccountsWithPlaidOutput>(accounts, 200);
  })
  .get('/connections', authMiddleware, async (c) => {
    const userId = c.get('userId')!;

    const connections = await db
      .selectFrom('app.plaidItems')
      .selectAll()
      .where('userId', '=', userId)
      .execute();

    return c.json(connections, 200);
  })
  .get(
    '/institution-accounts',
    authMiddleware,
    zValidator('query', institutionAccountsSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const accounts = await db
        .selectFrom('app.financeAccounts')
        .selectAll()
        .where((eb) =>
          eb.and([eb('userId', '=', userId), eb('institutionId', '=', input.institutionId)]),
        )
        .execute();

      return c.json<AccountInstitutionAccountsOutput>(accounts, 200);
    },
  )
  .get('/all', authMiddleware, async (c) => {
    const userId = c.get('userId')!;

    const [accounts, connections] = await Promise.all([
      db
        .selectFrom('app.financeAccounts')
        .selectAll()
        .where('userId', '=', userId)
        .orderBy('createdAt', 'desc')
        .execute(),
      db.selectFrom('app.plaidItems').selectAll().where('userId', '=', userId).execute(),
    ]);

    return c.json(
      {
        accounts: accounts.map((a) => ({ ...a, transactions: [] })),
        connections,
      } as AccountAllOutput,
      200,
    );
  });
