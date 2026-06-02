import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { portfolios } from './portfolios'

export const socialLinks = pgTable(
  'social_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull()
      .unique(), // One-to-one relationship with portfolio

    github: varchar('github', { length: 500 }),
    linkedin: varchar('linkedin', { length: 500 }),
    twitter: varchar('twitter', { length: 500 }),
    website: varchar('website', { length: 500 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('social_links_portfolio_id_idx').on(table.portfolioId)]
)

// Type exports for Drizzle ORM tables
export type SocialLinks = typeof socialLinks.$inferSelect
export type NewSocialLinks = typeof socialLinks.$inferInsert
