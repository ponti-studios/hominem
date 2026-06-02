import { boolean, index, json, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import type { PortfolioTheme } from '../types'
import { users } from './users'

export const portfolios = pgTable(
  'portfolios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(), // Enforce one portfolio per user
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    isPublic: boolean('is_public').default(true).notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    // Personal Information (normalized from JSON)
    name: varchar('name', { length: 255 }).notNull(),
    initials: varchar('initials', { length: 10 }),
    jobTitle: varchar('job_title', { length: 255 }).notNull(),
    bio: text('bio').notNull(),
    tagline: varchar('tagline', { length: 500 }).notNull(),

    // Location
    currentLocation: varchar('current_location', { length: 255 }).notNull(),
    locationTagline: varchar('location_tagline', { length: 255 }),

    // Availability
    availabilityStatus: boolean('availability_status').default(false).notNull(),
    availabilityMessage: varchar('availability_message', { length: 500 }),

    // Contact
    email: varchar('email', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }),

    // Theme settings (simple object is fine)
    theme: json('theme').$type<PortfolioTheme>(),

    // Copyright
    copyright: varchar('copyright', { length: 255 }),

    // Profile Image
    profileImageUrl: varchar('profile_image_url', { length: 500 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('portfolio_user_id_idx').on(table.userId),
    index('portfolio_slug_idx').on(table.slug),
    index('portfolio_public_idx').on(table.isPublic),
    index('portfolio_active_idx').on(table.isActive),
    index('portfolio_email_idx').on(table.email),
    // Composite indexes for common queries
    index('portfolio_public_active_idx').on(table.isPublic, table.isActive),
    index('portfolio_user_active_idx').on(table.userId, table.isActive),
  ]
)

// Type exports for Drizzle ORM tables
export type Portfolio = typeof portfolios.$inferSelect
export type NewPortfolio = typeof portfolios.$inferInsert
