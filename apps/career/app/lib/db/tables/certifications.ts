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
import { users } from './users'
import { workExperiences } from './work-experiences'

// Professional certifications
export const certifications = pgTable(
  'certifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // Basic Information
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    issuingOrganization: varchar('issuing_organization', { length: 255 }).notNull(),

    // Dates
    issueDate: timestamp('issue_date').notNull(),
    expirationDate: timestamp('expiration_date'),
    nextRenewalDate: timestamp('next_renewal_date'),

    // Status
    status: varchar('status', { length: 50 }).default('active').notNull(),

    // Optional work experience link
    workExperienceId: uuid('work_experience_id').references(() => workExperiences.id, {
      onDelete: 'set null',
    }),

    // Simple categorization
    category: varchar('category', { length: 100 }),

    // Cost tracking
    cost: integer('cost'),

    // Display options
    isVisible: boolean('is_visible').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('certifications_user_id_idx').on(table.userId),
    index('certifications_status_idx').on(table.status),
    index('certifications_category_idx').on(table.category),
    index('certifications_issue_date_idx').on(table.issueDate),
    index('certifications_expiration_date_idx').on(table.expirationDate),
    index('certifications_work_exp_idx').on(table.workExperienceId),
    // Composite indexes for common queries
    index('certifications_user_status_idx').on(table.userId, table.status),
    index('certifications_user_visible_idx').on(table.userId, table.isVisible),
    index('certifications_user_sort_idx').on(table.userId, table.sortOrder, table.isVisible),
    // Check constraints
    check(
      'certifications_status_check',
      sql`${table.status} IN ('active', 'expired', 'pending_renewal', 'archived')`
    ),
    check(
      'certifications_category_check',
      sql`${table.category} IN ('technical', 'leadership', 'compliance', 'industry', 'language', 'project_management', 'security', 'cloud', 'data', 'design')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type Certification = typeof certifications.$inferSelect
export type NewCertification = typeof certifications.$inferInsert
