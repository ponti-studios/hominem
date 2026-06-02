import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// Users table - stores basic user information
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    name: varchar('name', { length: 100 }).notNull(),
    supabaseUserId: varchar('supabase_user_id', { length: 255 }).unique(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_email_idx').on(table.email),
    index('users_supabase_user_id_idx').on(table.supabaseUserId),
  ]
)

// Type exports for Drizzle ORM tables
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
