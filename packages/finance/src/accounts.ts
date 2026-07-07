import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { FinanceAccounts, Selectable } from '@hominem/db';
import { sql } from 'kysely';

import { getAffectedRows } from './utils';

export async function createAccount(
  input: Partial<Selectable<FinanceAccounts>> & { user_id: string; name: string },
): Promise<Selectable<FinanceAccounts>> {
  const id = input.id ?? crypto.randomUUID();
  const account_type = input.account_type ?? 'checking';
  const balance = input.balance ?? 0;

  const result = await db
    .insertInto('finance_accounts')
    .values({
      id,
      user_id: input.user_id,
      name: input.name,
      account_type,
      balance,
      data: input.data ?? {},
    })
    .returningAll()
    .executeTakeFirst();

  if (!result) {
    throw new Error('Failed to create account');
  }

  return result;
}

export async function listAccounts(user_id: string): Promise<Selectable<FinanceAccounts>[]> {
  const result = await db
    .selectFrom('finance_accounts')
    .selectAll()
    .where('user_id', '=', user_id)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export async function getAccountById(
  accountId: string,
  user_id?: string,
): Promise<Selectable<FinanceAccounts> | null> {
  if (user_id) {
    const result = await db
      .selectFrom('finance_accounts')
      .selectAll()
      .where('id', '=', accountId)
      .where('user_id', '=', user_id)
      .limit(1)
      .executeTakeFirst();
    return result ?? null;
  }

  const result = await db
    .selectFrom('finance_accounts')
    .selectAll()
    .where('id', '=', accountId)
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function updateAccount(
  input: Partial<Selectable<FinanceAccounts>> & { id: string; user_id?: string },
): Promise<Selectable<FinanceAccounts> | null> {
  const existing = await getAccountById(input.id, input.user_id);
  if (!existing) {
    return null;
  }

  const nextName = input.name ?? existing.name;
  const nextType = input.account_type ?? existing.account_type;
  const nextBalance = input.balance ?? existing.balance;

  const result = await db
    .updateTable('finance_accounts')
    .set({
      name: nextName,
      account_type: nextType,
      balance: nextBalance,
      data: input.data ?? existing.data,
      updated_at: new Date(),
    })
    .where('id', '=', input.id)
    .where('user_id', '=', existing.user_id)
    .returningAll()
    .executeTakeFirst();

  return result ?? null;
}

export async function deleteAccount(accountId: string, user_id?: string): Promise<boolean> {
  if (user_id) {
    const result = await db
      .deleteFrom('finance_accounts')
      .where('id', '=', accountId)
      .where('user_id', '=', user_id)
      .executeTakeFirst();
    return getAffectedRows(result) > 0;
  }

  const result = await db
    .deleteFrom('finance_accounts')
    .where('id', '=', accountId)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export const listAccountsWithRecentTransactions = listAccounts;

export const getAccountWithPlaidInfo = getAccountById;

export const listAccountsWithPlaidInfo = listAccounts;

export async function getAccountsForInstitution(
  institutionId: string,
  user_id: string,
): Promise<Selectable<FinanceAccounts>[]> {
  const result = await db
    .selectFrom('finance_accounts')
    .selectAll()
    .where('user_id', '=', user_id)
    .where(sql<boolean>`institution_id = ${institutionId}`)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export async function upsertAccount(
  input: Partial<Selectable<FinanceAccounts>> & { user_id: string },
): Promise<Selectable<FinanceAccounts>> {
  if (!input.name) {
    throw new Error('upsertAccount requires name');
  }

  if (input.data && (input.data as Record<string, unknown>).plaidAccountId) {
    const plaidAccountId = (input.data as Record<string, unknown>).plaidAccountId as string;
    const existingResult = await db
      .selectFrom('finance_accounts')
      .selectAll()
      .where('user_id', '=', input.user_id)
      .where(sql<boolean>`data ->> 'plaidAccountId' = ${plaidAccountId}`)
      .limit(1)
      .executeTakeFirst();
    const existing = existingResult ?? null;
    if (existing) {
      const updated = await updateAccount({
        id: existing.id,
        user_id: input.user_id,
        name: input.name,
        ...(input.account_type ? { account_type: input.account_type } : {}),
        ...(input.balance !== undefined ? { balance: input.balance } : {}),
        data: input.data,
      });
      if (!updated) {
        throw new Error('Failed to update existing plaid account');
      }
      return updated;
    }
  }

  return createAccount({
    user_id: input.user_id,
    name: input.name,
    ...(input.id !== undefined ? { id: input.id } : {}),
    ...(input.account_type ? { account_type: input.account_type } : {}),
    ...(input.balance !== undefined ? { balance: input.balance } : {}),
    ...(input.data ? { data: input.data } : {}),
  });
}

export async function getUserAccounts(
  user_id: string,
  itemId?: string,
): Promise<Selectable<FinanceAccounts>[]> {
  if (!itemId) {
    return listAccounts(user_id);
  }

  const result = await db
    .selectFrom('finance_accounts')
    .selectAll()
    .where('user_id', '=', user_id)
    .where(sql<boolean>`data ->> 'plaidItemId' = ${itemId}`)
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export async function getAccountByPlaidId(
  plaidAccountId: string,
  user_id?: string,
): Promise<Selectable<FinanceAccounts> | null> {
  if (user_id) {
    const result = await db
      .selectFrom('finance_accounts')
      .selectAll()
      .where('user_id', '=', user_id)
      .where(sql<boolean>`data ->> 'plaidAccountId' = ${plaidAccountId}`)
      .limit(1)
      .executeTakeFirst();
    return result ?? null;
  }

  const result = await db
    .selectFrom('finance_accounts')
    .selectAll()
    .where(sql<boolean>`data ->> 'plaidAccountId' = ${plaidAccountId}`)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'asc')
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}
