import type { Selectable } from 'kysely';

import type { DbHandle } from '../../transaction';
import type { AppUserSocialLinks } from '../../types/database';

type UserSocialLinksRow = Selectable<AppUserSocialLinks>;

export interface UserSocialLinksRecord {
  userId: string;
  github: string | null;
  linkedin: string | null;
  twitter: string | null;
  website: string | null;
  createdat: string;
  updatedat: string;
}

export interface SaveUserSocialLinksInput {
  github?: string | null;
  linkedin?: string | null;
  twitter?: string | null;
  website?: string | null;
}

function toUserSocialLinksRecord(row: UserSocialLinksRow): UserSocialLinksRecord {
  return {
    userId: row.userId,
    github: row.github,
    linkedin: row.linkedin,
    twitter: row.twitter,
    website: row.website,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
  };
}

export const SocialLinksRepository = {
  async get(handle: DbHandle, ownerUserid: string): Promise<UserSocialLinksRecord | null> {
    const row = await handle
      .selectFrom('app.userSocialLinks')
      .selectAll()
      .where('userId', '=', ownerUserid)
      .executeTakeFirst();

    return row ? toUserSocialLinksRecord(row as UserSocialLinksRow) : null;
  },

  async save(
    handle: DbHandle,
    ownerUserid: string,
    input: SaveUserSocialLinksInput,
  ): Promise<UserSocialLinksRecord> {
    const existing = await handle
      .selectFrom('app.userSocialLinks')
      .selectAll()
      .where('userId', '=', ownerUserid)
      .executeTakeFirst();

    if (existing) {
      const updated = await handle
        .updateTable('app.userSocialLinks')
        .set({
          github: input.github ?? null,
          linkedin: input.linkedin ?? null,
          twitter: input.twitter ?? null,
          website: input.website ?? null,
        })
        .where('userId', '=', ownerUserid)
        .returningAll()
        .executeTakeFirstOrThrow();

      return toUserSocialLinksRecord(updated as UserSocialLinksRow);
    }

    const created = await handle
      .insertInto('app.userSocialLinks')
      .values({
        userId: ownerUserid,
        github: input.github ?? null,
        linkedin: input.linkedin ?? null,
        twitter: input.twitter ?? null,
        website: input.website ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toUserSocialLinksRecord(created as UserSocialLinksRow);
  },
};
