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
import type { ApplicationStage, InterviewEntry } from '../types'
import { companies } from './companies'
import { users } from './users'

// Job Applications table - for tracking job applications
export const jobApplications = pgTable(
  'job_applications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    companyId: uuid('company_id')
      .references(() => companies.id, { onDelete: 'cascade' })
      .notNull(),

    position: varchar('position', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
    startDate: timestamp('start_date').notNull(),
    endDate: timestamp('end_date'),

    location: varchar('location', { length: 255 }),
    jobPosting: text('job_posting'),

    // Job posting structured data
    requirements: json('requirements').$type<string[]>().default([]),
    skills: json('skills').$type<string[]>().default([]),
    jobPostingUrl: varchar('job_posting_url', { length: 500 }),
    jobPostingWordCount: integer('job_posting_word_count'),

    // Enhanced Salary Tracking
    salaryQuoted: text('salary_quoted'), // Keep for backward compatibility
    salaryAccepted: text('salary_accepted'), // Keep for backward compatibility

    // Structured Salary Data
    salaryExpected: integer('salary_expected'), // What you hoped for, in cents
    salaryRequested: integer('salary_requested'), // What you asked for, in cents
    salaryOffered: integer('salary_offered'), // Initial offer, in cents
    salaryNegotiated: integer('salary_negotiated'), // After negotiation, in cents
    salaryFinal: integer('salary_final'), // Final accepted amount, in cents
    totalCompOffered: integer('total_comp_offered'), // Including equity/bonuses, in cents
    totalCompFinal: integer('total_comp_final'), // Final total comp, in cents

    equityOffered: varchar('equity_offered', { length: 100 }), // "0.5%", "1000 shares"
    equityFinal: varchar('equity_final', { length: 100 }),
    bonusOffered: integer('bonus_offered'), // in cents
    bonusFinal: integer('bonus_final'), // in cents

    // Application Tracking
    source: varchar('source', { length: 100 }), // "linkedin", "indeed", "referral", "company_website"
    applicationDate: timestamp('application_date'),
    responseDate: timestamp('response_date'),
    firstInterviewDate: timestamp('first_interview_date'),
    offerDate: timestamp('offer_date'),
    decisionDate: timestamp('decision_date'),

    // Outcome Details
    rejectionReason: varchar('rejection_reason', { length: 255 }),
    withdrawalReason: varchar('withdrawal_reason', { length: 255 }),

    // Time Metrics (auto-calculated or manually entered)
    timeToResponse: integer('time_to_response'), // days from application to first response
    timeToFirstInterview: integer('time_to_first_interview'), // days
    timeToOffer: integer('time_to_offer'), // days from application to offer
    timeToDecision: integer('time_to_decision'), // days to make final decision
    coverLetter: text('cover_letter'),
    resume: text('resume'),
    jobId: varchar('job_id', { length: 100 }),
    link: varchar('link', { length: 500 }),
    phoneScreen: text('phone_screen'),
    reference: boolean('reference').default(false).notNull(),

    // Enhanced fields
    interviewDates: json('interview_dates').$type<Array<InterviewEntry>>().default([]),

    companyNotes: text('company_notes'), // Research about the company
    negotiationNotes: text('negotiation_notes'), // Salary negotiation tracking

    // Recruiter Information
    recruiterName: varchar('recruiter_name', { length: 255 }),
    recruiterEmail: varchar('recruiter_email', { length: 255 }),
    recruiterLinkedin: varchar('recruiter_linkedin', { length: 500 }),

    stages: json('stages').$type<Array<ApplicationStage>>().default([]),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('job_applications_user_id_idx').on(table.userId),
    index('job_applications_company_id_idx').on(table.companyId),
    index('job_applications_status_idx').on(table.status),
    index('job_applications_start_date_idx').on(table.startDate),
    index('job_applications_application_date_idx').on(table.applicationDate),
    index('job_applications_salary_final_idx').on(table.salaryFinal),
    index('job_applications_source_idx').on(table.source),
    index('job_applications_offer_date_idx').on(table.offerDate),
    // Composite indexes for common queries
    index('job_applications_user_status_idx').on(table.userId, table.status),
    index('job_applications_user_date_idx').on(table.userId, table.startDate),
    index('job_applications_user_app_date_idx').on(table.userId, table.applicationDate),
    index('job_applications_user_salary_idx').on(table.userId, table.salaryFinal),
    index('job_applications_status_salary_idx').on(table.status, table.salaryFinal),
    // Indexes for job posting data
    index('job_applications_requirements_idx').on(table.requirements),
    index('job_applications_skills_idx').on(table.skills),
    index('job_applications_job_posting_url_idx').on(table.jobPostingUrl),
    // Check constraints
    check(
      'job_applications_status_check',
      sql`${table.status} IN ('APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'FINAL_INTERVIEW', 'OFFER', 'ACCEPTED', 'REJECTED', 'WITHDRAWN')`
    ),
  ]
)

// Type exports for Drizzle ORM tables
export type JobApplication = typeof jobApplications.$inferSelect
export type NewJobApplication = typeof jobApplications.$inferInsert
