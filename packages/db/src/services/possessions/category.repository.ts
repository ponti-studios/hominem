import { sql, type Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppPossessionCategories } from '../../types/database';

type CategoryRow = Selectable<AppPossessionCategories>;

/** A managed possessions category. */
export interface PossessionCategoryRecord {
  id: string;
  name: string;
}

function toCategory(row: CategoryRow): PossessionCategoryRecord {
  return { id: row.id, name: row.name };
}

// The unique identity of a category is its owner and name, case-insensitively
// (see migration 20261016160000_possession_categories.sql).
const sameName = (name: string) => sql<boolean>`lower(btrim(name)) = lower(btrim(${name}))`;

export const PossessionCategoryRepository = {
  async list(handle: DbHandle, userId: string): Promise<PossessionCategoryRecord[]> {
    const rows = await handle
      .selectFrom('app.possessionCategories')
      .selectAll()
      .where('ownerUserid', '=', userId)
      .orderBy('name', 'asc')
      .execute();
    return rows.map(toCategory);
  },

  /**
   * Finds or creates the managed record for a name, matching case-insensitively
   * so `Technology` and `technology` are one category. Returns the canonical
   * record, whose `name` is the spelling the caller should store.
   */
  async resolve(handle: DbHandle, userId: string, name: string): Promise<PossessionCategoryRecord> {
    const trimmed = name.trim();
    const existing = await handle
      .selectFrom('app.possessionCategories')
      .selectAll()
      .where('ownerUserid', '=', userId)
      .where(sameName(trimmed))
      .executeTakeFirst();
    if (existing) return toCategory(existing);

    const inserted = await handle
      .insertInto('app.possessionCategories')
      .values({ ownerUserid: userId, name: trimmed })
      .onConflict((oc) => oc.doNothing())
      .returningAll()
      .executeTakeFirst();
    if (inserted) return toCategory(inserted);

    // Lost a race with a concurrent insert of the same name: read the winner.
    const raced = await handle
      .selectFrom('app.possessionCategories')
      .selectAll()
      .where('ownerUserid', '=', userId)
      .where(sameName(trimmed))
      .executeTakeFirstOrThrow();
    return toCategory(raced);
  },
};
