import { and, eq } from 'drizzle-orm'
import { db } from '~/lib/db'
import type {
  ApplicationFile,
  ApplicationNote,
  ApplicationWithCompany,
  InterviewEntry,
  JobApplicationUpdate,
} from '~/lib/db/schema'
import { applicationNotes, companies, jobApplications } from '~/lib/db/schema'

export interface ApplicationDetailData {
  application: ApplicationWithCompany
  notes: ApplicationNote[]
  files: ApplicationFile[]
}

export class JobApplicationsService {
  /**
   * Get application details with company information and notes
   */
  static async getApplicationDetail(
    applicationId: string,
    userId: string
  ): Promise<ApplicationDetailData> {
    // Fetch application with company details
    const applicationData = await db
      .select({
        // Application fields
        id: jobApplications.id,
        userId: jobApplications.userId,
        position: jobApplications.position,
        status: jobApplications.status,
        startDate: jobApplications.startDate,
        endDate: jobApplications.endDate,
        location: jobApplications.location,
        jobPosting: jobApplications.jobPosting,
        salaryQuoted: jobApplications.salaryQuoted,
        salaryAccepted: jobApplications.salaryAccepted,
        coverLetter: jobApplications.coverLetter,
        resume: jobApplications.resume,
        phoneScreen: jobApplications.phoneScreen,
        reference: jobApplications.reference,
        interviewDates: jobApplications.interviewDates,
        companyNotes: jobApplications.companyNotes,
        negotiationNotes: jobApplications.negotiationNotes,
        recruiterName: jobApplications.recruiterName,
        recruiterEmail: jobApplications.recruiterEmail,
        recruiterLinkedin: jobApplications.recruiterLinkedin,
        stages: jobApplications.stages,
        createdAt: jobApplications.createdAt,
        updatedAt: jobApplications.updatedAt,
        // Company fields
        company: {
          id: companies.id,
          name: companies.name,
          website: companies.website,
          industry: companies.industry,
          size: companies.size,
          location: companies.location,
          description: companies.description,
        },
      })
      .from(jobApplications)
      .leftJoin(companies, eq(jobApplications.companyId, companies.id))
      .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)))
      .limit(1)

    if (!applicationData.length) {
      throw new Error('Application not found')
    }

    // Fetch notes
    const notes = await db
      .select()
      .from(applicationNotes)
      .where(eq(applicationNotes.applicationId, applicationId))
      .orderBy(applicationNotes.createdAt)

    return {
      application: applicationData[0] as ApplicationWithCompany,
      notes,
      files: [], // TODO: Implement files when file upload is ready
    }
  }

  /**
   * Verify application ownership
   */
  static async verifyOwnership(applicationId: string, userId: string): Promise<boolean> {
    const application = await db
      .select()
      .from(jobApplications)
      .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)))
      .limit(1)

    return application.length > 0
  }

  /**
   * Update application details
   */
  static async updateApplication(
    applicationId: string,
    updates: JobApplicationUpdate
  ): Promise<void> {
    if (Object.keys(updates).length > 0) {
      updates.updatedAt = new Date()
      await db.update(jobApplications).set(updates).where(eq(jobApplications.id, applicationId))
    }
  }

  /**
   * Add a note to an application
   */
  static async addNote(
    applicationId: string,
    type: string,
    title: string | null,
    content: string
  ): Promise<void> {
    await db.insert(applicationNotes).values({
      applicationId,
      type: type || 'general',
      title,
      content,
    })
  }

  /**
   * Delete a note
   */
  static async deleteNote(noteId: string): Promise<void> {
    await db.delete(applicationNotes).where(eq(applicationNotes.id, noteId))
  }

  /**
   * Add an interview to an application
   */
  static async addInterview(applicationId: string, interview: InterviewEntry): Promise<void> {
    // Get current interviews
    const currentApplication = await db
      .select({ interviewDates: jobApplications.interviewDates })
      .from(jobApplications)
      .where(eq(jobApplications.id, applicationId))
      .limit(1)

    const currentInterviews = currentApplication[0]?.interviewDates || []
    const updatedInterviews = [...currentInterviews, interview]

    await db
      .update(jobApplications)
      .set({
        interviewDates: updatedInterviews,
        updatedAt: new Date(),
      })
      .where(eq(jobApplications.id, applicationId))
  }

  /**
   * Get application by ID for ownership verification
   */
  static async getApplicationById(applicationId: string, userId: string) {
    const application = await db
      .select()
      .from(jobApplications)
      .where(and(eq(jobApplications.id, applicationId), eq(jobApplications.userId, userId)))
      .limit(1)

    return application[0] || null
  }
}
