import { sql } from 'drizzle-orm'
import { check, index, json, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { portfolios } from './portfolios'

// Analytics table - for tracking portfolio views and engagement
export const analytics = pgTable(
  'analytics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull(),

    // Event tracking
    event: varchar('event', { length: 100 }).notNull(),
    path: varchar('path', { length: 500 }),

    // Visitor information
    visitorId: varchar('visitor_id', { length: 100 }), // Anonymous visitor tracking
    ipAddress: varchar('ip_address', { length: 50 }),
    userAgent: text('user_agent'),
    referer: varchar('referer', { length: 500 }),

    // Geolocation
    country: varchar('country', { length: 100 }),
    city: varchar('city', { length: 100 }),

    // Additional metadata
    metadata: json('metadata').$type<Record<string, unknown>>(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('analytics_portfolio_id_idx').on(table.portfolioId),
    index('analytics_event_idx').on(table.event),
    index('analytics_visitor_id_idx').on(table.visitorId),
    // Composite indexes for common dashboard queries
    index('analytics_portfolio_event_date_idx').on(table.portfolioId, table.event, table.createdAt),
    index('analytics_portfolio_date_idx').on(table.portfolioId, table.createdAt),
    // Check constraint for valid events
    check(
      'analytics_event_check',
      sql`${table.event} IN ('view', 'contact_click', 'project_click', 'skill_click', 'social_click', 'download_resume', 'copy_email')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type Analytics = typeof analytics.$inferSelect
export type NewAnalytics = typeof analytics.$inferInsert
