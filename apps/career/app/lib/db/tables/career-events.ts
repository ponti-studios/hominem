import { sql } from 'drizzle-orm'
import {
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
import type { CareerGoals, MarketSalaryRange } from '../types'
import { users } from './users'
import { workExperiences } from './work-experiences'

// Career Events table - tracks major career milestones and transitions
export const careerEvents = pgTable(
  'career_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    workExperienceId: uuid('work_experience_id').references(() => workExperiences.id, {
      onDelete: 'cascade',
    }),

    // Event Classification
    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventDate: timestamp('event_date').notNull(),

    // Title/Role Changes
    previousTitle: varchar('previous_title', { length: 255 }),
    newTitle: varchar('new_title', { length: 255 }),
    previousLevel: varchar('previous_level', { length: 50 }),
    newLevel: varchar('new_level', { length: 50 }),

    // Financial Changes
    previousSalary: integer('previous_salary'), // in cents
    newSalary: integer('new_salary'), // in cents
    salaryIncrease: integer('salary_increase'), // calculated field in cents
    increasePercentage: varchar('increase_percentage', { length: 10 }),

    previousTotalComp: integer('previous_total_comp'), // in cents
    newTotalComp: integer('new_total_comp'), // in cents
    totalCompIncrease: integer('total_comp_increase'), // in cents

    // Bonus/Equity Changes
    equityGranted: integer('equity_granted'), // shares or dollar value
    equityVesting: varchar('equity_vesting', { length: 100 }),
    bonusAmount: integer('bonus_amount'), // in cents
    bonusType: varchar('bonus_type', { length: 50 }),

    // Additional Context
    description: text('description'),
    achievements: json('achievements').$type<string[]>().default([]),
    skillsGained: json('skills_gained').$type<string[]>().default([]),

    // Performance Context
    performanceRating: varchar('performance_rating', { length: 50 }),
    managerFeedback: text('manager_feedback'),
    selfAssessment: text('self_assessment'),

    // Market Context
    marketSalaryRange: json('market_salary_range').$type<MarketSalaryRange>(),

    // Goals and Planning
    careerGoals: json('career_goals').$type<CareerGoals>(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('career_events_user_id_idx').on(table.userId),
    index('career_events_work_exp_id_idx').on(table.workExperienceId),
    index('career_events_event_type_idx').on(table.eventType),
    index('career_events_event_date_idx').on(table.eventDate),
    index('career_events_salary_increase_idx').on(table.salaryIncrease),
    // Composite indexes for common queries
    index('career_events_user_date_idx').on(table.userId, table.eventDate),
    index('career_events_user_type_idx').on(table.userId, table.eventType),
    index('career_events_timeline_idx').on(table.userId, table.eventDate, table.eventType),
    // Check constraints
    check(
      'career_events_type_check',
      sql`${table.eventType} IN ('promotion', 'raise', 'bonus', 'equity_grant', 'role_change', 'department_change', 'location_change', 'performance_review', 'goal_achievement', 'skill_milestone', 'manager_change', 'team_expansion')`
    ),
    check(
      'career_events_bonus_type_check',
      sql`${table.bonusType} IN ('annual', 'performance', 'retention', 'signing', 'spot', 'referral', 'project')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type CareerEvent = typeof careerEvents.$inferSelect
export type NewCareerEvent = typeof careerEvents.$inferInsert
