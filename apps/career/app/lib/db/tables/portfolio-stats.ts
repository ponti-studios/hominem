import { index, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { portfolios } from './portfolios'

// Portfolio Stats table - separate table for personal stats
export const portfolioStats = pgTable(
  'portfolio_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull(),

    label: varchar('label', { length: 255 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('portfolio_stats_portfolio_id_idx').on(table.portfolioId),
    index('portfolio_stats_sort_order_idx').on(table.sortOrder),
    index('portfolio_stats_portfolio_sort_idx').on(table.portfolioId, table.sortOrder),
  ]
)

// Type exports for Drizzle ORM tables
export type PortfolioStats = typeof portfolioStats.$inferSelect
export type NewPortfolioStats = typeof portfolioStats.$inferInsert
