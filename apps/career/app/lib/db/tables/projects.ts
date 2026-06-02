import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { portfolios } from './portfolios'
import { workExperiences } from './work-experiences'

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull(),

    title: varchar('title', { length: 255 }).notNull(),
    description: text('description').notNull(),
    shortDescription: varchar('short_description', { length: 500 }),

    // Links and media
    liveUrl: varchar('live_url', { length: 500 }),
    githubUrl: varchar('github_url', { length: 500 }),
    imageUrl: varchar('image_url', { length: 500 }),
    videoUrl: varchar('video_url', { length: 500 }),

    // Technical details
    technologies: json('technologies').$type<string[]>().default([]),
    status: varchar('status', { length: 50 }).default('completed').notNull(),

    // Timeline
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),

    // Optional work experience link
    workExperienceId: uuid('work_experience_id').references(() => workExperiences.id, {
      onDelete: 'set null',
    }),

    // Display options
    isFeatured: boolean('is_featured').default(false).notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('projects_portfolio_id_idx').on(table.portfolioId),
    index('projects_status_idx').on(table.status),
    index('projects_featured_idx').on(table.isFeatured),
    index('projects_sort_order_idx').on(table.sortOrder),
    index('projects_work_exp_idx').on(table.workExperienceId),
    // Composite indexes for common queries
    index('projects_portfolio_featured_visible_idx').on(
      table.portfolioId,
      table.isFeatured,
      table.isVisible
    ),
    index('projects_portfolio_visible_idx').on(table.portfolioId, table.isVisible),
    index('projects_work_exp_visible_idx').on(table.workExperienceId, table.isVisible),
    // Check constraints
    check(
      'projects_status_check',
      sql`${table.status} IN ('in-progress', 'completed', 'archived')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
