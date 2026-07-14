import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { AppFinanceAccounts } from '@hominem/db';
import type { Insertable, Selectable, Updateable } from 'kysely';

import { getAffectedRows } from './utils';

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

export async function createAccount(
  input: CreateAccountInput,
): Promise<Selectable<AppFinanceAccounts>> {
  const id = input.id ?? crypto.randomUUID();
  const accountType = input.accountType ?? 'checking';
  const currentBalance = input.currentBalance ?? 0;

  const result = await db
    .insertInto('app.financeAccounts')
    .values({
      id,
      userId: input.userId,
      name: input.name,
      accountType,
      currentBalance,
      metadata: input.metadata ?? {},
      ...(input.plaidAccountId ? { plaidAccountId: input.plaidAccountId } : {}),
      ...(input.plaidItemId ? { plaidItemId: input.plaidItemId } : {}),
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Failed to create account');
  }

  return result;
}

export async function listAccounts(userId: string): Promise<Selectable<AppFinanceAccounts>[]> {
  return db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export async function getAccountById(
  accountId: string,
  userId?: string,
): Promise<Selectable<AppFinanceAccounts> | null> {
  if (userId) {
    const result = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('id', '=', accountId)
      .where('userId', '=', userId)
      .limit(1)
      .executeTakeFirst();
    return result ?? null;
  }

  const result = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('id', '=', accountId)
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function updateAccount(
  input: UpdateAccountInput,
): Promise<Selectable<AppFinanceAccounts> | null> {
  const existing = await getAccountById(input.id, input.userId);
  if (!existing) {
    return null;
  }

  const nextName = input.name ?? existing.name;
  const nextType = input.accountType ?? existing.accountType;
  const nextBalance = input.currentBalance ?? existing.currentBalance;

  const result = await db
    .updateTable('app.financeAccounts')
    .set({
      name: nextName,
      accountType: nextType,
      currentBalance: nextBalance,
      metadata: input.metadata ?? existing.metadata,
      updatedAt: new Date(),
    })
    .where('id', '=', input.id)
    .where('userId', '=', existing.userId)
    .returningAll()
    .executeTakeFirst();

  return result ?? null;
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

export const listAccountsWithRecentTransactions = listAccounts;

export const getAccountWithPlaidInfo = getAccountById;

export const listAccountsWithPlaidInfo = listAccounts;

export async function getAccountsForInstitution(
  institutionId: string,
  userId: string,
): Promise<Selectable<AppFinanceAccounts>[]> {
  return db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('userId', '=', userId)
    .where('institutionId', '=', institutionId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export async function upsertAccount(
  input: UpsertAccountInput,
): Promise<Selectable<AppFinanceAccounts>> {
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
        ...(input.currentBalance !== undefined ? { currentBalance: input.currentBalance } : {}),
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
    ...(input.currentBalance !== undefined ? { currentBalance: input.currentBalance } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.plaidAccountId ? { plaidAccountId: input.plaidAccountId } : {}),
    ...(input.plaidItemId ? { plaidItemId: input.plaidItemId } : {}),
  });
}

export async function getUserAccounts(
  userId: string,
  itemId?: string,
): Promise<Selectable<AppFinanceAccounts>[]> {
  if (!itemId) {
    return listAccounts(userId);
  }

  return db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('userId', '=', userId)
    .where('plaidItemId', '=', itemId)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export async function getAccountByPlaidId(
  plaidAccountId: string,
  userId?: string,
): Promise<Selectable<AppFinanceAccounts> | null> {
  if (userId) {
    const result = await db
      .selectFrom('app.financeAccounts')
      .selectAll()
      .where('userId', '=', userId)
      .where('plaidAccountId', '=', plaidAccountId)
      .limit(1)
      .executeTakeFirst();
    return result ?? null;
  }

  const result = await db
    .selectFrom('app.financeAccounts')
    .selectAll()
    .where('plaidAccountId', '=', plaidAccountId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'asc')
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}
