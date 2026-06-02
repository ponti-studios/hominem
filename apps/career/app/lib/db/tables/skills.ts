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

// Skills table - stores individual skills
export const skills = pgTable(
  'skills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull(),

    name: varchar('name', { length: 255 }).notNull(),
    level: integer('level').notNull(), // 1-100
    category: varchar('category', { length: 100 }), // e.g., 'technical', 'leadership', 'design'
    icon: varchar('icon', { length: 100 }), // Icon identifier or class name

    // Additional metadata
    description: text('description'),
    yearsOfExperience: integer('years_of_experience'),

    // Display options
    isVisible: boolean('is_visible').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('skills_portfolio_id_idx').on(table.portfolioId),
    index('skills_category_idx').on(table.category),
    index('skills_sort_order_idx').on(table.sortOrder),
    index('skills_visible_idx').on(table.isVisible),
    index('skills_level_idx').on(table.level),
    // Composite indexes for common queries
    index('skills_portfolio_visible_idx').on(table.portfolioId, table.isVisible),
    index('skills_portfolio_category_idx').on(table.portfolioId, table.category),
    index('skills_portfolio_sort_idx').on(table.portfolioId, table.sortOrder),
    // Check constraints
    check('skills_level_check', sql`${table.level} >= 1 AND ${table.level} <= 100`),
  ]
)

// Type exports for Drizzle ORM tables
export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
