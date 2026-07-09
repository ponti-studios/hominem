import type { Selectable } from 'kysely';
import { sql } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppCompanies } from '../../types/database';

export type CompanyRow = Selectable<AppCompanies>;

export interface CompanyRecord {
  id: string;
  ownerUserid: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: number | null;
  location: string | null;
  description: string | null;
  createdat: string;
  updatedat: string;
}

export interface FindOrCreateCompanyInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  size?: number | null;
  location?: string | null;
  description?: string | null;
}

export interface UpdateCompanyInput {
  name?: string;
  website?: string | null;
  industry?: string | null;
  size?: number | null;
  location?: string | null;
  description?: string | null;
  updatedat?: Date;
}

export function toCompanyRecord(row: CompanyRow): CompanyRecord {
  return {
    id: row.id,
    ownerUserid: row.ownerUserid,
    name: row.name,
    website: row.website,
    industry: row.industry,
    size: row.size,
    location: row.location,
    description: row.description,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const CompanyRepository = {
  async findOrCreate(
    handle: DbHandle,
    ownerUserid: string,
    input: FindOrCreateCompanyInput,
  ): Promise<CompanyRecord> {
    const normalizedName = input.name.trim();

    const existing = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .where(sql<string>`lower(name)`, '=', normalizedName.toLowerCase())
      .executeTakeFirst();

    if (existing) {
      return toCompanyRecord(existing as CompanyRow);
    }

    const created = await handle
      .insertInto('app.companies')
      .values({
        ownerUserid: ownerUserid,
        name: normalizedName,
        website: input.website ?? null,
        industry: input.industry ?? null,
        size: input.size ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toCompanyRecord(created as CompanyRow);
  },

  async update(
    handle: DbHandle,
    ownerUserid: string,
    companyId: string,
    updates: UpdateCompanyInput,
  ): Promise<CompanyRecord> {
    if (Object.keys(updates).length === 0) {
      const existing = await handle
        .selectFrom('app.companies')
        .selectAll()
        .where('id', '=', companyId)
        .where('ownerUserid', '=', ownerUserid)
        .executeTakeFirst();

      if (!existing) {
        throw new NotFoundError('Company', { companyId, ownerUserid });
      }

      return toCompanyRecord(existing as CompanyRow);
    }

    const payload: UpdateCompanyInput = { ...updates };

    if (payload.name !== undefined) {
      const normalizedName = payload.name.trim();
      if (!normalizedName) {
        throw new Error('Company name is required');
      }
      payload.name = normalizedName;
    }

    const updated = await handle
      .updateTable('app.companies')
      .set({ ...payload, updatedat: payload.updatedat ?? new Date() })
      .where('id', '=', companyId)
      .where('ownerUserid', '=', ownerUserid)
      .returningAll()
      .executeTakeFirst();

    if (!updated) {
      throw new NotFoundError('Company', { companyId, ownerUserid });
    }

    return toCompanyRecord(updated as CompanyRow);
  },
};
