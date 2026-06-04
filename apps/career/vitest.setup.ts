import '@testing-library/jest-dom'
import { afterAll, afterEach, beforeAll } from 'vitest'

import { db, sql } from '@hominem/db'
import { server } from './test/msw/server'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})

beforeAll(async () => {
  await db.execute(
    sql`ALTER TABLE app.portfolios DROP CONSTRAINT IF EXISTS app_portfolios_owner_userId_key`,
  )
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS app.user_portfolio_preferences (
      user_id text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      current_portfolio_id uuid REFERENCES app.portfolios(id) ON DELETE SET NULL,
      createdat timestamptz NOT NULL DEFAULT now(),
      updatedat timestamptz NOT NULL DEFAULT now()
    )
  `)
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
