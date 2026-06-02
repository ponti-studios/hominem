import { sql } from 'drizzle-orm'
import { boolean, check, index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { jobApplications } from './job-applications'

// Application Notes table - for detailed notes and feedback
export const applicationNotes = pgTable(
  'application_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .references(() => jobApplications.id, { onDelete: 'cascade' })
      .notNull(),

    type: varchar('type', { length: 50 }).notNull(), // 'general', 'interview', 'feedback', 'research'
    title: varchar('title', { length: 255 }),
    content: text('content').notNull(),
    isPrivate: boolean('is_private').default(true).notNull(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('application_notes_app_id_idx').on(table.applicationId),
    index('application_notes_type_idx').on(table.type),
    index('application_notes_created_at_idx').on(table.createdAt),
    // Check constraint for note types
    check(
      'application_notes_type_check',
      sql`${table.type} IN ('general', 'interview', 'feedback', 'research', 'follow_up')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type ApplicationNote = typeof applicationNotes.$inferSelect
export type NewApplicationNote = typeof applicationNotes.$inferInsert
