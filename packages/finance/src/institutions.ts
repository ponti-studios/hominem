import crypto from 'node:crypto';

import { db, sql } from '@hominem/db/core';
import type { Selectable } from '@hominem/db/core';
import type { AppFinanceInstitutions } from '@hominem/db/types';

type InstitutionRow = Selectable<AppFinanceInstitutions>;

export async function getAllInstitutions(): Promise<InstitutionRow[]> {
  return db
    .selectFrom('app.financeInstitutions')
    .selectAll()
    .orderBy('name', 'asc')
    .orderBy('id', 'asc')
    .execute();
}

export async function createInstitution(name: string): Promise<InstitutionRow> {
  const result = await db
    .insertInto('app.financeInstitutions')
    .values({
      id: crypto.randomUUID(),
      name,
    })
    .returningAll()
    .executeTakeFirst();
  if (!result) {
    throw new Error('Failed to create institution');
  }
  return result;
}

export async function ensureInstitutionExists(name: string): Promise<InstitutionRow> {
  const trimmed = name.trim();
  const existing = await db
    .selectFrom('app.financeInstitutions')
    .selectAll()
    .where(sql<boolean>`lower(name) = lower(${trimmed})`)
    .limit(1)
    .executeTakeFirst();
  if (existing) {
    return existing;
  }
  return createInstitution(trimmed);
}
