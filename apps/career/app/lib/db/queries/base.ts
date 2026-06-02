import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '../index'
import type { Company, JobApplication, WorkExperience } from '../schema'
import { careerEvents, companies, jobApplications, portfolios, workExperiences } from '../schema'

/**
 * Base query functions for common database operations
 */

// Get all work experiences for a user (with portfolio join)
export async function getUserWorkExperiences(userId: string) {
  return db
    .select()
    .from(workExperiences)
    .innerJoin(portfolios, eq(workExperiences.portfolioId, portfolios.id))
    .where(eq(portfolios.userId, userId))
    .orderBy(asc(workExperiences.startDate))
}

// Get work experiences in descending order (most recent first)
export async function getUserWorkExperiencesDesc(userId: string) {
  return db
    .select()
    .from(workExperiences)
    .innerJoin(portfolios, eq(workExperiences.portfolioId, portfolios.id))
    .where(eq(portfolios.userId, userId))
    .orderBy(desc(workExperiences.startDate))
}

// Get career events for a user
export async function getUserCareerEvents(userId: string, limit?: number) {
  const query = db
    .select()
    .from(careerEvents)
    .where(eq(careerEvents.userId, userId))
    .orderBy(desc(careerEvents.eventDate))

  if (limit) {
    return query.limit(limit)
  }

  return query
}

// Get job applications for a user with company data
export async function getUserJobApplications(userId: string) {
  return db
    .select({
      jobApplication: jobApplications,
      company: companies,
    })
    .from(jobApplications)
    .leftJoin(companies, eq(jobApplications.companyId, companies.id))
    .where(eq(jobApplications.userId, userId))
    .orderBy(desc(jobApplications.applicationDate))
}

// Get current/active work experience for a user
export async function getCurrentWorkExperience(userId: string) {
  const experiences = await db
    .select()
    .from(workExperiences)
    .innerJoin(portfolios, eq(workExperiences.portfolioId, portfolios.id))
    .where(eq(portfolios.userId, userId))
    .orderBy(desc(workExperiences.startDate))

  // Find the experience without an end date (current job) or the most recent one
  const workExps = experiences.map((e) => e.work_experiences)
  return workExps.find((exp) => !exp.endDate) || workExps[0] || null
}

// Get first work experience for a user (earliest career start)
export async function getFirstWorkExperience(userId: string) {
  const experiences = await db
    .select()
    .from(workExperiences)
    .innerJoin(portfolios, eq(workExperiences.portfolioId, portfolios.id))
    .where(eq(portfolios.userId, userId))
    .orderBy(asc(workExperiences.startDate))
    .limit(1)

  return experiences[0]?.work_experiences || null
}

// Get work experiences within a date range
export async function getWorkExperiencesByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return db
    .select()
    .from(workExperiences)
    .innerJoin(portfolios, eq(workExperiences.portfolioId, portfolios.id))
    .where(eq(portfolios.userId, userId))
    .orderBy(asc(workExperiences.startDate))
  // Note: Additional date filtering would need to be added based on specific requirements
}

// Get career events by type
export async function getCareerEventsByType(userId: string, eventType: string) {
  return db
    .select()
    .from(careerEvents)
    .where(and(eq(careerEvents.userId, userId), eq(careerEvents.eventType, eventType)))
    .orderBy(desc(careerEvents.eventDate))
}

// Get job applications by status
export async function getJobApplicationsByStatus(userId: string, status: string) {
  return db
    .select({
      jobApplication: jobApplications,
      company: companies,
    })
    .from(jobApplications)
    .leftJoin(companies, eq(jobApplications.companyId, companies.id))
    .where(and(eq(jobApplications.userId, userId), eq(jobApplications.status, status)))
    .orderBy(desc(jobApplications.applicationDate))
}

// Get companies a user has worked at
export async function getUserCompanies(userId: string) {
  const experiences = await getUserWorkExperiences(userId)
  const companyNames = [...new Set(experiences.map((e) => e.work_experiences.company))]
  return companyNames
}

// Helper to extract work experiences from joined query results
export function extractWorkExperiences(joinedResults: Array<{ work_experiences: WorkExperience }>) {
  return joinedResults.map((result) => result.work_experiences)
}

export type JobApplicationWithCompany = JobApplication & {
  company: Company | null
}

export function extractJobApplications(
  joinedResults: Array<{
    jobApplication: JobApplication
    company: Company | null
  }>
) {
  return joinedResults.map((result) => ({
    ...result.jobApplication,
    company: result.company,
  }))
}

// Get a specific work experience by ID for a user
export async function getWorkExperienceById(userId: string, experienceId: string) {
  const result = await db
    .select()
    .from(workExperiences)
    .innerJoin(portfolios, eq(workExperiences.portfolioId, portfolios.id))
    .where(and(eq(portfolios.userId, userId), eq(workExperiences.id, experienceId)))
    .limit(1)

  return result[0]?.work_experiences || null
}

// Update a work experience
export async function updateWorkExperience(
  userId: string,
  experienceId: string,
  updates: Partial<WorkExperience>
) {
  // First verify the user owns this work experience
  const existing = await getWorkExperienceById(userId, experienceId)
  if (!existing) {
    throw new Error('Work experience not found or access denied')
  }

  // Update the work experience
  const result = await db
    .update(workExperiences)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(workExperiences.id, experienceId))
    .returning()

  return result[0]
}
