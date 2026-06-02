import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { portfolios } from './portfolios'

// Testimonials table - for recommendations and testimonials
export const testimonials = pgTable(
  'testimonials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull(),

    name: varchar('name', { length: 255 }).notNull(),
    title: varchar('title', { length: 255 }),
    company: varchar('company', { length: 255 }),
    content: text('content').notNull(),

    // Contact and media
    avatarUrl: varchar('avatar_url', { length: 500 }),
    linkedinUrl: varchar('linkedin_url', { length: 500 }),

    // Rating and validation
    rating: integer('rating'), // 1-5 stars
    isVerified: boolean('is_verified').default(false).notNull(),

    // Display options
    isVisible: boolean('is_visible').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('testimonials_portfolio_id_idx').on(table.portfolioId),
    index('testimonials_rating_idx').on(table.rating),
    index('testimonials_sort_order_idx').on(table.sortOrder),
    // Composite indexes for common queries
    index('testimonials_portfolio_verified_idx').on(
      table.portfolioId,
      table.isVerified,
      table.isVisible
    ),
    index('testimonials_portfolio_visible_idx').on(table.portfolioId, table.isVisible),
    // Check constraints
    check('testimonials_rating_check', sql`${table.rating} >= 1 AND ${table.rating} <= 5`),
  ]
)

// Type exports for Drizzle ORM tables
export type Testimonial = typeof testimonials.$inferSelect
export type NewTestimonial = typeof testimonials.$inferInsert
