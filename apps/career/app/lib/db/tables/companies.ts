import { index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

// Companies table - for job application companies
export const companies = pgTable(
  'companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    website: varchar('website', { length: 500 }),
    industry: varchar('industry', { length: 100 }),
    size: integer('size'),
    location: varchar('location', { length: 255 }),
    description: text('description'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('companies_name_idx').on(table.name),
    index('companies_industry_idx').on(table.industry),
    index('companies_size_idx').on(table.size),
  ]
)

// Type exports for Drizzle ORM tables
export type Company = typeof companies.$inferSelect
export type NewCompany = typeof companies.$inferInsert
