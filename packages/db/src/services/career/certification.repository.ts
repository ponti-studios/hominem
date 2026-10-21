import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppCareerCertifications } from '../../types/database';
import {
  CAREER_PAGE_DEFAULT_LIMIT,
  decodeCareerCursor,
  encodeCareerCursor,
  toCareerPage,
  type CareerPage,
} from './pagination';

export type CareerCertificationRecord = Selectable<AppCareerCertifications>;

export type CareerCertificationInput = {
  positionId?: string | null;
  name: string;
  description?: string | null;
  issuingOrganization: string;
  issueDate?: string | null;
  expirationDate?: string | null;
  status?: string | null;
  category?: string | null;
  isVisible?: boolean;
  sortOrder?: number;
};

export const CertificationRepository = {
  async list(handle: DbHandle, ownerUserId: string): Promise<CareerCertificationRecord[]> {
    return handle
      .selectFrom('app.careerCertifications')
      .selectAll()
      .where('ownerUserid', '=', ownerUserId)
      .orderBy('sortOrder', 'asc')
      .execute();
  },

  // Sorted by sort order, with `id` as the tiebreaker that gives the keyset walk a total order.
  async listPage(
    handle: DbHandle,
    ownerUserId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<CareerPage<CareerCertificationRecord>> {
    const limit = opts?.limit ?? CAREER_PAGE_DEFAULT_LIMIT;
    const filter = '';
    const cursor = opts?.cursor
      ? decodeCareerCursor(opts.cursor, {
          route: 'career.certifications',
          filter,
          keys: ['int', 'uuid'],
        })
      : null;

    let query = handle
      .selectFrom('app.careerCertifications')
      .selectAll()
      .where('ownerUserid', '=', ownerUserId);

    if (cursor) {
      const [sortOrder, id] = cursor;
      query = query.where(sql<boolean>`("sort_order", "id") > (${sortOrder}::int, ${id}::uuid)`);
    }

    const rows = await query
      .orderBy('sortOrder', 'asc')
      .orderBy('id', 'asc')
      .limit(limit + 1)
      .execute();

    return toCareerPage(rows, limit, (last) =>
      encodeCareerCursor('career.certifications', filter, [last.sortOrder, last.id]),
    );
  },

  async get(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
  ): Promise<CareerCertificationRecord | null> {
    const row = await handle
      .selectFrom('app.careerCertifications')
      .selectAll()
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    return row ?? null;
  },

  async create(
    handle: DbHandle,
    ownerUserId: string,
    input: CareerCertificationInput,
  ): Promise<CareerCertificationRecord> {
    return handle
      .insertInto('app.careerCertifications')
      .values({ ownerUserid: ownerUserId, ...input })
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  async update(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
    input: Partial<CareerCertificationInput>,
  ): Promise<CareerCertificationRecord | null> {
    const result = await handle
      .updateTable('app.careerCertifications')
      .set(input)
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returningAll()
      .executeTakeFirst();
    return result ?? null;
  },

  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const deleted = await handle
      .deleteFrom('app.careerCertifications')
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returning('id')
      .executeTakeFirst();
    return deleted !== undefined;
  },
};
