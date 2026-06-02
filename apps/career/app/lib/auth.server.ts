import { CareerRepository, getDb, runInTransaction } from '@hominem/db'
import { redirect } from 'react-router'

export interface User {
  id: string
  email: string
  name: string
}

const API_URL =
  process.env.VITE_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://localhost:3000'

export async function getServerSession(request: Request) {
  const headers = new Headers()
  const cookie = request.headers.get('cookie')
  if (cookie) {
    headers.set('cookie', cookie)
  }

  try {
    const response = await fetch(
      new URL('/api/auth/get-session', API_URL).toString(),
      { method: 'GET', headers }
    )
    if (!response.ok) return { user: null, session: null }
    const payload = await response.json() as {
      user: { id: string; email: string; name?: string | null } | null
      session: unknown
    } | null
    return {
      user: payload?.user ?? null,
      session: payload?.session ?? null,
    }
  } catch {
    return { user: null, session: null }
  }
}

export async function getAuthenticatedUser(request: Request): Promise<User | null> {
  try {
    const { user: authUser } = await getServerSession(request)
    if (!authUser?.email) return null

    const db = getDb()

    let dbUser = await db
      .selectFrom('user')
      .select(['id', 'email', 'name'])
      .where('email', '=', authUser.email)
      .limit(1)
      .execute()

    if (dbUser.length === 0) {
      const result = await runInTransaction(async (tx) => {
        const name = authUser.name || 'User'
        const newUser = await tx
          .insertInto('user')
          .values([{ id: crypto.randomUUID(), email: authUser.email, name }])
          .returning(['id', 'email', 'name'])
          .execute()

        await CareerRepository.createDefaultPortfolio(tx, {
          userId: newUser[0].id,
          email: authUser.email,
          name,
        })

        return newUser
      })
      dbUser = result
    }

    return { id: dbUser[0].id, email: dbUser[0].email, name: dbUser[0].name }
  } catch (error) {
    console.error('Auth error:', error)
    return null
  }
}

export function requireAuth(user: User | null): User {
  if (!user) {
    throw redirect('/login')
  }
  return user
}

export function redirectIfAuthenticated(user: User | null, redirectTo = '/account') {
  if (user) {
    throw redirect(redirectTo)
  }
}
