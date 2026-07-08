import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { User } from '../../types/database';

type UserRow = Selectable<User>;

export interface UserRecord {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FindUserInput {
  id: string;
}

function toUserRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    emailVerified: row.emailVerified,
    name: row.name,
    image: row.image,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  };
}

export const UserRepository = {
  async findByIdOrEmail(handle: DbHandle, input: FindUserInput): Promise<UserRecord | null> {
    const row = await handle
      .selectFrom('user')
      .selectAll()
      .where((eb) => eb.or([eb('id', '=', input.id), eb('email', '=', input.id)]))
      .executeTakeFirst();

    if (!row) return null;

    return toUserRecord(row as UserRow);
  },

  async loadByIdOrEmail(handle: DbHandle, input: FindUserInput): Promise<UserRecord> {
    const record = await UserRepository.findByIdOrEmail(handle, input);
    if (!record) {
      throw new NotFoundError('User', { userId: input.id });
    }
    return record;
  },
};
