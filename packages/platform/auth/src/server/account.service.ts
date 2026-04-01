import { db } from '@hominem/db'
import type { AccountSelectRow } from '../contracts'

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface AccountRecord {
  id: string
  userId: string
  type: string
  provider: string
  providerAccountId: string
  refreshToken: string | null
  accessToken: string | null
  expiresAt: string | null
  tokenType: string | null
  scope: string | null
  idToken: string | null
  sessionState: string | null
}

export interface AccountInsert {
  id?: string
  userId: string
  type?: string
  provider: string
  providerAccountId: string
  refreshToken?: string | null
  accessToken?: string | null
  expiresAt?: Date | null
  tokenType?: string | null
  scope?: string | null
  idToken?: string | null
  sessionState?: string | null
}

function toRecord(row: AccountSelectRow): AccountRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: 'oauth',
    provider: row.providerId,
    providerAccountId: row.accountId,
    refreshToken: null,
    accessToken: null,
    expiresAt: null,
    tokenType: null,
    scope: null,
    idToken: null,
    sessionState: null,
  }
}

export async function listAccountsByProvider(
  userId: string,
  provider: string,
): Promise<AccountRecord[]> {
  const rows = (await db
    .selectFrom('account')
    .selectAll()
    .where('userId', '=', userId)
    .where('providerId', '=', provider)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'asc')
    .execute()) as unknown as AccountSelectRow[]
  return rows.map(toRecord)
}

export async function getAccountByUserAndProvider(
  userId: string,
  provider: string,
): Promise<AccountRecord | null> {
  const row = (await db
    .selectFrom('account')
    .selectAll()
    .where('userId', '=', userId)
    .where('providerId', '=', provider)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'asc')
    .limit(1)
    .executeTakeFirst()) as AccountSelectRow | undefined
  return row ? toRecord(row) : null
}

export async function getAccountByProviderAccountId(
  providerAccountId: string,
  provider: string,
): Promise<AccountRecord | null> {
  const row = (await db
    .selectFrom('account')
    .selectAll()
    .where('accountId', '=', providerAccountId)
    .where('providerId', '=', provider)
    .limit(1)
    .executeTakeFirst()) as AccountSelectRow | undefined
  return row ? toRecord(row) : null
}

export async function createAccount(data: AccountInsert): Promise<AccountRecord | null> {
  const row = (await db
    .insertInto('account')
    .values({
      id: data.id ?? generateUUID(),
      userId: data.userId,
      accountId: data.providerAccountId,
      providerId: data.provider,
    })
    .onConflict((oc) => oc.columns(['accountId', 'providerId', 'userId']).doNothing())
    .returningAll()
    .executeTakeFirst()) as AccountSelectRow | undefined
  return row ? toRecord(row) : null
}

export async function updateAccount(
  id: string,
  updates: Partial<AccountInsert>,
): Promise<AccountRecord | null> {
  const updateData: Partial<Record<'accountId' | 'providerId', string>> = {}
  if (updates.providerAccountId !== undefined) updateData.accountId = updates.providerAccountId
  if (updates.provider !== undefined) updateData.providerId = updates.provider
  if (Object.keys(updateData).length === 0) return null

  const row = (await db
    .updateTable('account')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()) as AccountSelectRow | undefined
  return row ? toRecord(row) : null
}

export async function deleteAccountForUser(
  id: string,
  userId: string,
  provider: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom('account')
    .where('id', '=', id)
    .where('userId', '=', userId)
    .where('providerId', '=', provider)
    .executeTakeFirst()
  return (result.numDeletedRows ?? 0n) > 0n
}
