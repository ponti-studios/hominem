import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { jobApplications } from './job-applications'

// Application Files table - for file attachments
export const applicationFiles = pgTable(
  'application_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    applicationId: uuid('application_id')
      .references(() => jobApplications.id, { onDelete: 'cascade' })
      .notNull(),

    type: varchar('type', { length: 50 }).notNull(), // 'resume', 'cover_letter', 'portfolio', 'other'
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: text('file_url'), // For external files
    fileContent: text('file_content'), // For text content
    mimeType: varchar('mime_type', { length: 100 }),
    fileSize: integer('file_size'), // in bytes

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('application_files_app_id_idx').on(table.applicationId),
    index('application_files_type_idx').on(table.type),
    index('application_files_created_at_idx').on(table.createdAt),
    // Check constraint for file types
    check(
      'application_files_type_check',
      sql`${table.type} IN ('resume', 'cover_letter', 'portfolio', 'offer_letter', 'other')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type ApplicationFile = typeof applicationFiles.$inferSelect
export type NewApplicationFile = typeof applicationFiles.$inferInsert
