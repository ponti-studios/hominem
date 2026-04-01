/**
 * Raw database row shapes. These are internal to the server layer and must
 * never be exposed to clients.
 */

export interface UserRow {
  id: string
  email: string
  name: string | null
  image: string | null
  avatar_url: string | null
  is_admin: boolean
  email_verified: boolean
  created_at: string | null
  updated_at: string | null
}

export interface AccountSelectRow {
  id: string
  user_id: string
  provider: string
  account_id: string
  created_at?: string | null
}
