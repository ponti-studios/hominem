import { CareerRepository, db } from '@hominem/db';
import type {
  AppApplicationFiles,
  AppApplicationNotes,
  CareerCompanyRecord as Company,
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

export interface ApplicationDetailData {
  application: ApplicationWithCompany;
  notes: Selectable<AppApplicationNotes>[];
  files: Selectable<AppApplicationFiles>[];
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
   * Get application details with company information and notes
   */
  static async getApplicationDetail(
    applicationId: string,
    ownerUserid: string,
  ): Promise<ApplicationDetailData> {
    const applicationData = await db
      .selectFrom('app.jobApplications as application')
      .leftJoin('app.companies as company', 'company.id', 'application.companyId')
      .select([
        'application.id',
        'application.ownerUserid',
        'application.companyId',
        'application.position',
        'application.status',
        'application.startDate',
        'application.endDate',
        'application.location',
        'application.jobPosting',
        'application.requirements',
        'application.skills',
        'application.jobPostingUrl',
        'application.jobPostingWordCount',
        'application.salaryQuoted',
        'application.salaryAccepted',
        'application.salaryExpected',
        'application.salaryRequested',
        'application.salaryOffered',
        'application.salaryNegotiated',
        'application.salaryFinal',
        'application.totalCompOffered',
        'application.totalCompFinal',
        'application.equityOffered',
        'application.equityFinal',
        'application.bonusOffered',
        'application.bonusFinal',
        'application.source',
        'application.applicationDate',
        'application.responseDate',
        'application.firstInterviewDate',
        'application.offerDate',
        'application.decisionDate',
        'application.rejectionReason',
        'application.withdrawalReason',
        'application.timeToResponse',
        'application.timeToFirstInterview',
        'application.timeToOffer',
        'application.timeToDecision',
        'application.coverLetter',
        'application.resume',
        'application.jobId',
        'application.link',
        'application.phoneScreen',
        'application.reference',
        'application.interviewDates',
        'application.companyNotes',
        'application.negotiationNotes',
        'application.recruiterName',
        'application.recruiterEmail',
        'application.recruiterLinkedin',
        'application.stages',
        'application.createdat',
        'application.updatedat',
        'company.id as companyId',
        'company.name as companyName',
        'company.website as companyWebsite',
        'company.industry as companyIndustry',
        'company.size as companySize',
        'company.location as companyLocation',
        'company.description as companyDescription',
      ])
      .where('application.id', '=', applicationId)
      .where('application.ownerUserid', '=', ownerUserid)
      .executeTakeFirst();

    if (!applicationData) {
      throw new Error('Application not found');
    }

    const notesResult = await db
      .selectFrom('app.applicationNotes')
      .selectAll()
      .where('applicationId', '=', applicationId)
      .orderBy('createdat', 'asc')
      .execute();

    const company = applicationData.companyId
      ? ({
          id: applicationData.companyId,
          ownerUserid: '',
          name: applicationData.companyName || '',
          website: applicationData.companyWebsite,
          industry: applicationData.companyIndustry,
          size: applicationData.companySize,
          location: applicationData.companyLocation,
          description: applicationData.companyDescription,
          createdat: new Date(),
          updatedat: new Date(),
        } as Company)
      : null;

    const application = {
      id: applicationData.id,
      ownerUserid: applicationData.ownerUserid,
      position: applicationData.position,
      companyId: applicationData.companyId,
      status: applicationData.status,
      startDate: applicationData.startDate ? new Date(applicationData.startDate) : new Date(),
      endDate: applicationData.endDate ? new Date(applicationData.endDate) : null,
      location: applicationData.location,
      jobPosting: applicationData.jobPosting,
      requirements: Array.isArray(applicationData.requirements) ? applicationData.requirements : [],
      skills: Array.isArray(applicationData.skills) ? applicationData.skills : [],
      jobPostingUrl: applicationData.jobPostingUrl,
      jobPostingWordCount: applicationData.jobPostingWordCount,
      salaryQuoted: applicationData.salaryQuoted,
      salaryAccepted: applicationData.salaryAccepted,
      salaryExpected: applicationData.salaryExpected,
      salaryRequested: applicationData.salaryRequested,
      salaryOffered: applicationData.salaryOffered,
      salaryNegotiated: applicationData.salaryNegotiated,
      salaryFinal: applicationData.salaryFinal,
      totalCompOffered: applicationData.totalCompOffered,
      totalCompFinal: applicationData.totalCompFinal,
      equityOffered: applicationData.equityOffered,
      equityFinal: applicationData.equityFinal,
      bonusOffered: applicationData.bonusOffered,
      bonusFinal: applicationData.bonusFinal,
      source: applicationData.source,
      applicationDate: applicationData.applicationDate
        ? new Date(applicationData.applicationDate)
        : null,
      responseDate: applicationData.responseDate ? new Date(applicationData.responseDate) : null,
      firstInterviewDate: applicationData.firstInterviewDate
        ? new Date(applicationData.firstInterviewDate)
        : null,
      offerDate: applicationData.offerDate ? new Date(applicationData.offerDate) : null,
      decisionDate: applicationData.decisionDate ? new Date(applicationData.decisionDate) : null,
      rejectionReason: applicationData.rejectionReason,
      withdrawalReason: applicationData.withdrawalReason,
      timeToResponse: applicationData.timeToResponse,
      timeToFirstInterview: applicationData.timeToFirstInterview,
      timeToOffer: applicationData.timeToOffer,
      timeToDecision: applicationData.timeToDecision,
      coverLetter: applicationData.coverLetter,
      resume: applicationData.resume,
      jobId: applicationData.jobId,
      link: applicationData.link,
      phoneScreen: applicationData.phoneScreen,
      reference: applicationData.reference,
      interviewDates: Array.isArray(applicationData.interviewDates)
        ? (applicationData.interviewDates as unknown as InterviewEntry[])
        : [],
      companyNotes: applicationData.companyNotes,
      negotiationNotes: applicationData.negotiationNotes,
      recruiterName: applicationData.recruiterName,
      recruiterEmail: applicationData.recruiterEmail,
      recruiterLinkedin: applicationData.recruiterLinkedin,
      stages: Array.isArray(applicationData.stages) ? applicationData.stages : [],
      createdat: applicationData.createdat ? new Date(applicationData.createdat) : new Date(),
      updatedat: applicationData.updatedat ? new Date(applicationData.updatedat) : new Date(),
      company,
    } as unknown as ApplicationWithCompany;

    return {
      application,
      notes: notesResult,
      files: [],
    };
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
