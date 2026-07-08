import { CareerRepository, db } from '@hominem/db';
import type {
  AppApplicationNotes,
  CareerJobApplicationRecord,
  JsonObject,
  JsonValue,
  Selectable,
  UpdateCareerJobApplicationInput,
} from '@hominem/db';
import type {
  CareerInterviewEntry as InterviewEntry,
  CareerJobApplicationRecord as ApplicationWithCompany,
} from '@hominem/db';

import { JobApplicationStage, JobApplicationStatus } from '~/types/career';

export interface CreateApplicationInput {
  companyName: string;
  companyWebsite?: string | null;
  companyDescription?: string | null;
  position: string;
  status?: JobApplicationStatus;
  startDate?: Date;
  location?: string | null;
  jobPosting?: string | null;
  requirements?: string[];
  skills?: string[];
  jobPostingUrl?: string | null;
  jobPostingWordCount?: number | null;
  salaryQuoted?: string | null;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  recruiterLinkedin?: string | null;
  source?: string | null;
  link?: string | null;
}

function interviewEntryToJson(entry: InterviewEntry): JsonObject {
  return {
    type: entry.type,
    date: entry.date,
    duration: entry.duration,
    interviewer: entry.interviewer,
    notes: entry.notes,
  };
}

export class JobApplicationsService {
  /**
   * Get an application with company information
   */
  static async getApplication(
    applicationId: string,
    ownerUserid: string,
  ): Promise<ApplicationWithCompany> {
    const application = await CareerRepository.getApplicationById(db, ownerUserid, applicationId);

    if (!application) {
      throw new Error('Application not found');
    }

    return application;
  }

  /**
   * List notes for an application
   */
  static async listNotes(applicationId: string): Promise<Selectable<AppApplicationNotes>[]> {
    return db
      .selectFrom('app.applicationNotes')
      .selectAll()
      .where('applicationId', '=', applicationId)
      .orderBy('createdat', 'asc')
      .execute();
  }

  /**
   * Verify application ownership
   */
  static async verifyOwnership(applicationId: string, ownerUserid: string): Promise<boolean> {
    const application = await db
      .selectFrom('app.jobApplications')
      .select('id')
      .where('id', '=', applicationId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirst();

    return Boolean(application);
  }

  /**
   * Update application details
   */
  static async updateApplication(
    applicationId: string,
    updates: UpdateCareerJobApplicationInput,
    ownerUserid?: string,
  ): Promise<void> {
    if (Object.keys(updates).length === 0) {
      return;
    }

    let query = db.updateTable('app.jobApplications').set(updates).where('id', '=', applicationId);

    if (ownerUserid) {
      query = query.where('ownerUserid', '=', ownerUserid);
    }

    await query.executeTakeFirstOrThrow();
  }

  /**
   * Add a note to an application
   */
  static async addNote(
    applicationId: string,
    type: string,
    title: string | null,
    content: string,
  ): Promise<void> {
    await db
      .insertInto('app.applicationNotes')
      .values({
        applicationId: applicationId,
        type: type || 'general',
        title,
        content,
      })
      .execute();
  }

  /**
   * Delete a note
   */
  static async deleteNote(noteId: string): Promise<void> {
    await db.deleteFrom('app.applicationNotes').where('id', '=', noteId).execute();
  }

  /**
   * Add an interview to an application
   */
  static async addInterview(applicationId: string, interview: InterviewEntry): Promise<void> {
    const currentApplication = await db
      .selectFrom('app.jobApplications')
      .select('interviewDates')
      .where('id', '=', applicationId)
      .executeTakeFirst();

    const currentInterviews = Array.isArray(currentApplication?.interviewDates)
      ? (currentApplication.interviewDates as unknown as InterviewEntry[])
      : [];

    await db
      .updateTable('app.jobApplications')
      .set({
        interviewDates: [...currentInterviews, interview].map(interviewEntryToJson) as JsonValue,
      })
      .where('id', '=', applicationId)
      .executeTakeFirstOrThrow();
  }

  /**
   * Get application by ID for ownership verification
   */
  static async getApplicationById(applicationId: string, ownerUserid: string) {
    const application = await db
      .selectFrom('app.jobApplications')
      .selectAll()
      .where('id', '=', applicationId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirst();

    return application || null;
  }

  static async createApplication(
    ownerUserid: string,
    input: CreateApplicationInput,
  ): Promise<CareerJobApplicationRecord> {
    const company = await CareerRepository.findOrCreateCompany(db, ownerUserid, {
      name: input.companyName,
      website: input.companyWebsite ?? null,
      description: input.companyDescription ?? null,
    });

    return CareerRepository.createJobApplication(db, ownerUserid, {
      companyId: company.id,
      position: input.position,
      status: input.status ?? JobApplicationStatus.APPLIED,
      startDate: input.startDate ?? new Date(),
      location: input.location ?? null,
      jobPosting: input.jobPosting ?? null,
      requirements: input.requirements ?? [],
      skills: input.skills ?? [],
      jobPostingUrl: input.jobPostingUrl ?? null,
      jobPostingWordCount: input.jobPostingWordCount ?? null,
      salaryQuoted: input.salaryQuoted ?? null,
      recruiterName: input.recruiterName ?? null,
      recruiterEmail: input.recruiterEmail ?? null,
      recruiterLinkedin: input.recruiterLinkedin ?? null,
      source: input.source ?? null,
      link: input.link ?? null,
      reference: false,
      stages: [{ stage: JobApplicationStage.APPLICATION, date: new Date().toISOString() }],
    });
  }
}
