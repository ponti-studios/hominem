import { randomUUID } from 'crypto';

import { db } from '@hominem/db';
import type {
  AppFinanceAccounts,
  AppFinanceTransactions,
  AppPlaidItems,
} from '@hominem/db';
import type {
  AccountAllOutput,
  AccountConnectionsOutput,
  AccountCreateOutput,
  AccountData,
  AccountDeleteOutput,
  AccountGetOutput,
  AccountInstitutionAccountsOutput,
  AccountListOutput,
  AccountType,
  AccountUpdateOutput,
  AccountsWithPlaidOutput,
  PlaidConnection,
  TransactionData,
  TransactionType,
} from '@hominem/rpc/finance';
import {
  accountCreateSchema,
  accountDeleteSchema,
  accountGetSchema,
  accountListSchema,
  accountUpdateSchema,
  institutionAccountsSchema,
} from '@hominem/rpc/finance';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import * as z from 'zod';

import { NotFoundError } from '../errors';
import type { AppContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { toIsoString, toIsoStringOr } from '../utils/to-iso-string';

const emptyBodySchema = z.object({});

// configureStepUpStore(redis)

function normalizeAccountType(value: string): AccountType {
  if (
    value === 'checking' ||
    value === 'savings' ||
    value === 'credit' ||
    value === 'investment' ||
    value === 'cash' ||
    value === 'other'
  ) {
    return value;
  }
  return 'other';
}

function toAccountData(row: AppFinanceAccounts): AccountData {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    accountType: normalizeAccountType(row.account_type),
    currentBalance: row.balance ? Number(row.balance) : 0,
    plaidItemId: row.plaid_item_id ?? null,
  };
}

function toTransactionData(row: AppFinanceTransactions): TransactionData {
  const amount =
    typeof row.amount === 'string' ? Number.parseFloat(row.amount) : Number(row.amount);
  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    amount,
    description: row.description ?? '',
    date: toIsoString(row.date),
    type: (amount < 0 ? 'expense' : 'income') as TransactionType,
  };
}

function toAccountWithPlaidInfo(row: AppFinanceAccounts): AccountData & {
  institutionName?: string | null;
  plaidAccountId?: string | null;
} {
  return {
    ...toAccountData(row),
    institutionName: row.institution_name ?? null,
    plaidAccountId: null,
  };
}

function toPlaidConnection(
  row: AppPlaidItems,
  institutionName?: string,
): PlaidConnection {
  const createdAtStr = toIsoStringOr(row.created_at, new Date(0).toISOString());

  return {
    id: row.id,
    institutionId: row.institutionId ?? '',
    institutionName: institutionName ?? 'Institution',
    institutionLogo: null,
    status: row.error ? 'error' : row.cursor ? 'disconnected' : 'active',
    lastSynced: createdAtStr,
    accounts: 0,
  };
}

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
  .post('/list', authMiddleware, zValidator('json', accountListSchema), async (c) => {
    const userId = c.get('userId')!;
    const accounts = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .execute();
    return c.json<AccountListOutput>(accounts.map(toAccountData), 200);
  })
  .post('/get', authMiddleware, zValidator('json', accountGetSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const account = await getAccountWithOwnershipCheck(input.id, userId);
    const transactions = await getTransactionsForAccount(input.id, 200, 0);
    return c.json<AccountGetOutput>({
      ...toAccountWithPlaidInfo(account),
      plaidItemId: null,
      transactions: transactions.map(toTransactionData),
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
        accountType: normalizeAccountType(input.type),
        currentBalance: input.balance === undefined ? 0 : Number(input.balance),
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
    return c.json<AccountCreateOutput>(toAccountData(created), 201);
  })
  .post('/update', authMiddleware, zValidator('json', accountUpdateSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');

    await getAccountWithOwnershipCheck(input.id, userId);

    const now = new Date().toISOString();
    const updateValues: {
      updatedAt: string;
      name?: string;
      account_type?: AccountType;
      balance?: number;
    } = { updatedAt: now };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.type !== undefined) updateValues.account_type = normalizeAccountType(input.type);
    if (input.balance !== undefined) updateValues.balance = Number(input.balance);

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
    return c.json<AccountUpdateOutput>(toAccountData(updated), 200);
  })
  .post('/delete', authMiddleware, zValidator('json', accountDeleteSchema), async (c) => {
    const userId = c.get('userId')!;
    const input = c.req.valid('json');
    const auth = c.get('auth');

    await getAccountWithOwnershipCheck(input.id, userId);

    // Delete associated transactions first
    await db.deleteFrom('app.financeTransactions').where('accountId', '=', input.id).execute();

    // Delete the account
    await db.deleteFrom('app.financeAccounts').where('id', '=', input.id).execute();

    return c.json<AccountDeleteOutput>({ success: true }, 200);
  })
  .post('/with-plaid', authMiddleware, zValidator('json', emptyBodySchema), async (c) => {
    const userId = c.get('userId')!;
    const accounts = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .orderBy('createdAt', 'desc')
      .execute();

    return c.json<AccountsWithPlaidOutput>(
      accounts.map((account) => ({
        ...toAccountWithPlaidInfo(account),
        plaidItemId: null,
      })),
      200,
    );
  })
  .post('/connections', authMiddleware, zValidator('json', emptyBodySchema), async (c) => {
    const userId = c.get('userId')!;

    // Get Plaid connections from PlaidItems table
    const connections = await db
      .selectFrom('app.plaidItems')
      .selectAll()
      .where('userId', '=', userId)
      .execute();

    // Get accounts with institution info
    const institutions = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .execute();

    const institutionNames = new Map<string, string>();
    for (const account of institutions) {
      if (account.id && account.name) {
        institutionNames.set(account.id, account.name);
      }
    }

    const result: AccountConnectionsOutput = connections.map((connection): PlaidConnection => {
      const institutionId = connection.institutionId;
      return toPlaidConnection(
        connection,
        institutionId ? institutionNames.get(institutionId) : undefined,
      );
    });

    return c.json<AccountConnectionsOutput>(result, 200);
  })
  .post(
    '/institution-accounts',
    authMiddleware,
    zValidator('json', institutionAccountsSchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('json');
      const accounts = await db
        .selectFrom('app.financeAccounts')
        .selectAll()
        .where((eb) =>
          eb.and([eb('userId', '=', userId), eb('institutionId', '=', input.institutionId)]),
        )
        .execute();

      return c.json<AccountInstitutionAccountsOutput>(
        accounts.map((account) => ({
          ...toAccountWithPlaidInfo(account),
          plaidItemId: null,
        })),
        200,
      );
    },
  )
  .post('/all', authMiddleware, zValidator('json', emptyBodySchema), async (c) => {
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

    const payload: AccountAllOutput = {
      accounts: accounts.map((account) => ({
        ...toAccountWithPlaidInfo(account),
        transactions: [],
      })),
      connections: connections.map((connection) => toPlaidConnection(connection)),
    };
    return c.json<AccountAllOutput>(payload, 200);
  });
