import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { PlaidItems, Selectable } from '@hominem/db';

import { getAffectedRows } from './utils';

type PlaidItemRow = Selectable<PlaidItems>;

export async function listPlaidConnectionsForUser(user_id: string): Promise<PlaidItemRow[]> {
  const result = await db
    .selectFrom('plaid_items')
    .selectAll()
    .where('user_id', '=', user_id)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export async function getPlaidItemByUserAndItemId(
  user_id: string,
  item_id: string,
): Promise<PlaidItemRow | null> {
  const result = await db
    .selectFrom('plaid_items')
    .selectAll()
    .where('user_id', '=', user_id)
    .where('item_id', '=', item_id)
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function getPlaidItemById(id: string, user_id?: string): Promise<PlaidItemRow | null> {
  if (user_id) {
    const result = await db
      .selectFrom('plaid_items')
      .selectAll()
      .where('id', '=', id)
      .where('user_id', '=', user_id)
      .limit(1)
      .executeTakeFirst();
    return result ?? null;
  }

  const result = await db
    .selectFrom('plaid_items')
    .selectAll()
    .where('id', '=', id)
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function getPlaidItemByItemId(item_id: string): Promise<PlaidItemRow | null> {
  const result = await db
    .selectFrom('plaid_items')
    .selectAll()
    .where('item_id', '=', item_id)
    .orderBy('created_at', 'desc')
    .orderBy('id', 'asc')
    .limit(1)
    .executeTakeFirst();
  return result ?? null;
}

export async function upsertPlaidItem(
  input: PlaidItemRow & { access_token?: string | null },
): Promise<PlaidItemRow> {
  const existingResult = await db
    .selectFrom('plaid_items')
    .selectAll()
    .where('item_id', '=', input.item_id)
    .where('user_id', '=', input.user_id)
    .limit(1)
    .executeTakeFirst();
  const existing = existingResult ?? null;

  if (existing) {
    const updatedResult = await db
      .updateTable('plaid_items')
      .set({
        institution_id: input.institution_id ?? null,
        cursor: input.cursor ?? null,
        access_token: input.access_token ?? null,
        status: input.status ?? 'healthy',
        last_synced_at: input.last_synced_at ? new Date(input.last_synced_at) : null,
        updated_at: new Date(),
      })
      .where('id', '=', existing.id)
      .returningAll()
      .executeTakeFirst();
    const updated = updatedResult ?? null;
    if (!updated) {
      throw new Error('Failed to update plaid item');
    }
    return updated;
  }

  const createdResult = await db
    .insertInto('plaid_items')
    .values({
      id: input.id ?? crypto.randomUUID(),
      user_id: input.user_id,
      item_id: input.item_id,
      institution_id: input.institution_id ?? null,
      cursor: input.cursor ?? null,
      access_token: input.access_token ?? null,
      status: input.status ?? 'healthy',
      last_synced_at: input.last_synced_at ? new Date(input.last_synced_at) : null,
    })
    .returningAll()
    .executeTakeFirst();
  const created = createdResult ?? null;
  if (!created) {
    throw new Error('Failed to create plaid item');
  }
  return created;
}

export async function updatePlaidItemStatusByItemId(
  user_id: string,
  item_id: string,
  status: string,
): Promise<boolean> {
  const result = await db
    .updateTable('plaid_items')
    .set({
      status,
      updated_at: new Date(),
    })
    .where('user_id', '=', user_id)
    .where('item_id', '=', item_id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function updatePlaidItemStatusById(
  id: string,
  user_id: string,
  status: string,
): Promise<boolean> {
  const result = await db
    .updateTable('plaid_items')
    .set({
      status,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .where('user_id', '=', user_id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function updatePlaidItemCursor(id: string, cursor: string | null): Promise<boolean> {
  const result = await db
    .updateTable('plaid_items')
    .set({
      cursor,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function updatePlaidItemSyncStatus(
  id: string,
  status: string,
  error?: string | null,
): Promise<boolean> {
  const result = await db
    .updateTable('plaid_items')
    .set({
      status,
      error: error ?? null,
      last_synced_at: new Date(),
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function updatePlaidItemError(id: string, error: string | null): Promise<boolean> {
  const result = await db
    .updateTable('plaid_items')
    .set({
      error,
      updated_at: new Date(),
    })
    .where('id', '=', id)
    .executeTakeFirst();
  return getAffectedRows(result) > 0;
}

export async function deletePlaidItem(id: string, user_id?: string): Promise<boolean> {
  if (user_id) {
    const result = await db
      .deleteFrom('plaid_items')
      .where('id', '=', id)
      .where('user_id', '=', user_id)
      .executeTakeFirst();
    return getAffectedRows(result) > 0;
  }

  const result = await db.deleteFrom('plaid_items').where('id', '=', id).executeTakeFirst();
  return getAffectedRows(result) > 0;
}
