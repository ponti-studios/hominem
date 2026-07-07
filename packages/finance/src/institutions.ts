import crypto from 'node:crypto';

import { db } from '@hominem/db';
import type { FinancialInstitutions, Selectable } from '@hominem/db';

type InstitutionRow = Selectable<FinancialInstitutions>;

export async function getAllInstitutions(): Promise<InstitutionRow[]> {
  const result = await db
    .selectFrom('financial_institutions')
    .selectAll()
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
  return result;
}

export async function createInstitution(name: string): Promise<InstitutionRow> {
  const result = await db
    .insertInto('financial_institutions')
    .values({
      id: crypto.randomUUID(),
      name,
    })
    .returningAll()
    .executeTakeFirst();
  const row = result ?? null;
  if (!row) {
    throw new Error('Failed to create institution');
  }
  return row;
}

export async function ensureInstitutionExists(name: string): Promise<InstitutionRow> {
  const existing = await db
    .selectFrom('financial_institutions')
    .selectAll()
    .where('name', '=', name)
    .limit(1)
    .executeTakeFirst();
  if (existing) {
    return existing;
  }
  return createInstitution(name);
}
