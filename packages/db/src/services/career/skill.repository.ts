import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppCareerSkills } from '../../types/database';
import {
  CAREER_PAGE_DEFAULT_LIMIT,
  decodeCareerCursor,
  encodeCareerCursor,
  toCareerPage,
  type CareerPage,
} from './pagination';

export type CareerSkillRecord = Selectable<AppCareerSkills>;

export type CareerSkillInput = {
  name: string;
  category?: string | null;
  level?: number | null;
  yearsOfExperience?: number | null;
  description?: string | null;
  proof?: string | null;
  aiDerived?: boolean;
  isVisible?: boolean;
  sortOrder?: number;
  worklogEntryIds?: string[];
};

export const SkillRepository = {
  async list(handle: DbHandle, ownerUserId: string): Promise<CareerSkillRecord[]> {
    return handle
      .selectFrom('app.careerSkills')
      .selectAll()
      .where('ownerUserid', '=', ownerUserId)
      .orderBy('sortOrder', 'asc')
      .execute();
  },

  // Skills are listed by sort order; `id` breaks the ties that sort order alone leaves, so a
  // keyset walk sees every row exactly once.
  async listPage(
    handle: DbHandle,
    ownerUserId: string,
    opts?: { limit?: number; cursor?: string },
  ): Promise<CareerPage<CareerSkillRecord>> {
    const limit = opts?.limit ?? CAREER_PAGE_DEFAULT_LIMIT;
    const filter = '';
    const cursor = opts?.cursor
      ? decodeCareerCursor(opts.cursor, {
          route: 'career.skills',
          filter,
          keys: ['int', 'uuid'],
        })
      : null;

    let query = handle
      .selectFrom('app.careerSkills')
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
      encodeCareerCursor('career.skills', filter, [last.sortOrder, last.id]),
    );
  },

  async get(handle: DbHandle, ownerUserId: string, id: string): Promise<CareerSkillRecord | null> {
    const row = await handle
      .selectFrom('app.careerSkills')
      .selectAll()
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .executeTakeFirst();
    return row ?? null;
  },

  /** The skills that point at one worklog entry — the detail tool's `linkedSkillIds`. */
  async listIdsByWorklogEntryId(
    handle: DbHandle,
    ownerUserId: string,
    worklogEntryId: string,
  ): Promise<string[]> {
    const rows = await handle
      .selectFrom('app.careerSkills')
      .select('id')
      .where('ownerUserid', '=', ownerUserId)
      .where(sql<boolean>`"worklog_entry_ids" @> ${JSON.stringify([worklogEntryId])}::jsonb`)
      .orderBy('sortOrder', 'asc')
      .execute();
    return rows.map((row) => row.id);
  },

  async create(
    handle: DbHandle,
    ownerUserId: string,
    input: CareerSkillInput,
  ): Promise<CareerSkillRecord> {
    const { worklogEntryIds, ...rest } = input;
    return handle
      .insertInto('app.careerSkills')
      .values({
        ownerUserid: ownerUserId,
        ...rest,
        ...(worklogEntryIds === undefined
          ? {}
          : { worklogEntryIds: sql`${JSON.stringify(worklogEntryIds)}::jsonb` }),
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  async update(
    handle: DbHandle,
    ownerUserId: string,
    id: string,
    input: Partial<CareerSkillInput>,
  ): Promise<CareerSkillRecord | null> {
    const { worklogEntryIds, ...rest } = input;
    const result = await handle
      .updateTable('app.careerSkills')
      .set({
        ...rest,
        ...(worklogEntryIds === undefined
          ? {}
          : { worklogEntryIds: sql`${JSON.stringify(worklogEntryIds)}::jsonb` }),
      })
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returningAll()
      .executeTakeFirst();
    return result ?? null;
  },

  async remove(handle: DbHandle, ownerUserId: string, id: string): Promise<boolean> {
    const deleted = await handle
      .deleteFrom('app.careerSkills')
      .where('id', '=', id)
      .where('ownerUserid', '=', ownerUserId)
      .returning('id')
      .executeTakeFirst();
    return deleted !== undefined;
  },

  /** Diff-based replace: deletes skills no longer present, upserts the rest by name. */
  async replaceSkills(
    handle: DbHandle,
    ownerUserId: string,
    skills: CareerSkillInput[],
  ): Promise<CareerSkillRecord[]> {
    const existing = await this.list(handle, ownerUserId);
    const incomingNames = new Set(skills.map((s) => s.name));

    const toRemove = existing.filter((s) => !incomingNames.has(s.name));
    for (const skill of toRemove) {
      await this.remove(handle, ownerUserId, skill.id);
    }

    const results: CareerSkillRecord[] = [];
    for (const skill of skills) {
      const match = existing.find((s) => s.name === skill.name);
      if (match) {
        const updated = await this.update(handle, ownerUserId, match.id, skill);
        if (updated) results.push(updated);
      } else {
        results.push(await this.create(handle, ownerUserId, skill));
      }
    }

    return results;
  },
};
