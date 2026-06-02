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
import type {
  BonusHistoryEntry,
  PerformanceRating,
  SalaryAdjustment,
  SalaryRange,
  WorkExperienceBenefits,
  WorkExperienceMetadata,
} from '../types'
import { portfolios } from './portfolios'

// Work Experience table - stores individual work experiences
export const workExperiences = pgTable(
  'work_experiences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    portfolioId: uuid('portfolio_id')
      .references(() => portfolios.id, { onDelete: 'cascade' })
      .notNull(),

    role: varchar('role', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }).notNull(),
    description: text('description').notNull(),
    startDate: timestamp('start_date'),
    endDate: timestamp('end_date'),

    // Financial/Compensation Information
    baseSalary: integer('base_salary'), // Annual base salary in cents
    currency: varchar('currency', { length: 10 }).default('USD').notNull(),
    salaryRange: json('salary_range').$type<SalaryRange>(),
    totalCompensation: integer('total_compensation'), // Including equity, bonuses in cents
    equityValue: integer('equity_value'), // Estimated equity value in cents
    equityPercentage: varchar('equity_percentage', { length: 20 }),
    signingBonus: integer('signing_bonus'), // One-time signing bonus in cents
    annualBonus: integer('annual_bonus'), // Expected/average annual bonus in cents
    bonusHistory: json('bonus_history').$type<Array<BonusHistoryEntry>>().default([]),

    // Benefits and Perks
    benefits: json('benefits').$type<WorkExperienceBenefits>(),

    // Employment Details
    employmentType: varchar('employment_type', { length: 50 }).default('full-time').notNull(),
    workArrangement: varchar('work_arrangement', { length: 50 }).default('office').notNull(),
    seniorityLevel: varchar('seniority_level', { length: 50 }),
    department: varchar('department', { length: 100 }),
    teamSize: integer('team_size'),
    reportsTo: varchar('reports_to', { length: 255 }),
    directReports: integer('direct_reports').default(0),

    // Performance and Growth
    performanceRatings: json('performance_ratings').$type<Array<PerformanceRating>>().default([]),

    // Promotion/Raise History within this role
    salaryAdjustments: json('salary_adjustments').$type<Array<SalaryAdjustment>>().default([]),

    // Display information (existing)
    image: varchar('image', { length: 500 }),
    gradient: varchar('gradient', { length: 100 }),
    metrics: varchar('metrics', { length: 100 }),
    action: varchar('action', { length: 100 }),

    // Tags and metadata (enhanced)
    tags: json('tags').$type<string[]>().default([]),
    metadata: json('metadata').$type<WorkExperienceMetadata>(),

    // Ordering and display
    sortOrder: integer('sort_order').default(0).notNull(),
    isVisible: boolean('is_visible').default(true).notNull(),

    // Reason for leaving
    reasonForLeaving: varchar('reason_for_leaving', { length: 100 }),
    exitNotes: text('exit_notes'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('work_exp_portfolio_id_idx').on(table.portfolioId),
    index('work_exp_sort_order_idx').on(table.sortOrder),
    index('work_exp_visible_idx').on(table.isVisible),
    index('work_exp_created_at_idx').on(table.createdAt),
    index('work_exp_start_date_idx').on(table.startDate),
    index('work_exp_base_salary_idx').on(table.baseSalary),
    index('work_exp_employment_type_idx').on(table.employmentType),
    index('work_exp_seniority_level_idx').on(table.seniorityLevel),
    // Composite indexes for common queries
    index('work_exp_portfolio_visible_idx').on(table.portfolioId, table.isVisible),
    index('work_exp_portfolio_sort_idx').on(table.portfolioId, table.sortOrder),
    index('work_exp_portfolio_salary_idx').on(table.portfolioId, table.baseSalary),
    // Check constraints
    check(
      'work_exp_employment_type_check',
      sql`${table.employmentType} IN ('full-time', 'part-time', 'contract', 'freelance', 'internship', 'temporary')`
    ),
    check(
      'work_exp_work_arrangement_check',
      sql`${table.workArrangement} IN ('office', 'remote', 'hybrid', 'travel')`
    ),
    check(
      'work_exp_seniority_level_check',
      sql`${table.seniorityLevel} IN ('intern', 'entry-level', 'mid-level', 'senior', 'lead', 'principal', 'staff', 'director', 'vp', 'c-level')`
    ),
    check(
      'work_exp_reason_leaving_check',
      sql`${table.reasonForLeaving} IN ('promotion', 'better_opportunity', 'relocation', 'layoff', 'termination', 'contract_end', 'career_change', 'salary', 'culture', 'management', 'growth', 'personal')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type WorkExperience = typeof workExperiences.$inferSelect
export type NewWorkExperience = typeof workExperiences.$inferInsert
