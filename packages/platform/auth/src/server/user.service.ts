import { db } from '@hominem/db'
import type { UserRow } from '../contracts'
import type { User } from '../types'

export function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? undefined,
    image: row.image ?? undefined,
    isAdmin: false,
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  }
}

export class UserAuthService {
  static async findByIdOrEmail(opts: { id?: string; email?: string }): Promise<UserRow | null> {
    const { id, email } = opts
    if (!id && !email) return null

    let query = db.selectFrom('user').selectAll()

    if (id && email) {
      query = query.where((eb) => eb.or([eb('id', '=', id), eb('email', '=', email)]))
    } else if (id) {
      query = query.where('id', '=', id)
    } else {
      query = query.where('email', '=', email!)
    }

    const result = await query.limit(1).executeTakeFirst()
    return (result as unknown as UserRow) ?? null
  }

  static async getUserByEmail(email: string): Promise<UserRow | null> {
    const result = await db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .limit(1)
      .executeTakeFirst()
    return (result as unknown as UserRow) ?? null
  }

  static async getUserById(id: string): Promise<UserRow | null> {
    const result = await db
      .selectFrom('user')
      .selectAll()
      .where('id', '=', id)
      .limit(1)
      .executeTakeFirst()
    return (result as unknown as UserRow) ?? null
  }

  static async deleteUser(id: string): Promise<boolean> {
    const result = await db.deleteFrom('user').where('id', '=', id).executeTakeFirst()
    return (result.numDeletedRows ?? 0n) > 0n
  }
}
