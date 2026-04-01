/**
 * Raw database row shapes. These are internal to the server layer and must
 * never be exposed to clients.
 */

export interface UserRow {
  id: string
  email: string
  name: string | null
  image: string | null
  emailVerified: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface AccountSelectRow {
  id: string
  userId: string
  providerId: string
  accountId: string
  createdAt?: string | Date | null
}
