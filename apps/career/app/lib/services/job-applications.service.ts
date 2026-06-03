import { CareerRepository, getDb } from '@hominem/db';
import type { CareerCompanyRecord as Company, CareerJobApplicationRecord } from '@hominem/db';

import type {
  ApplicationFile,
  ApplicationNote,
  ApplicationWithCompany,
  InterviewEntry,
  JobApplicationUpdate,
} from '~/types/career-data';
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
  notes: ApplicationNote[];
  files: ApplicationFile[];
}

export class JobApplicationsService {
  /**
   * Get application details with company information and notes
   */
  static async getApplicationDetail(
    applicationId: string,
    userId: string,
  ): Promise<ApplicationDetailData> {
    const db = getDb();

    const applicationData = await db
      .selectFrom('app.job_applications as application')
      .leftJoin('app.companies as company', 'company.id', 'application.company_id')
      .select([
        'application.id',
        'application.owner_userid',
        'application.company_id',
        'application.position',
        'application.status',
        'application.start_date',
        'application.end_date',
        'application.location',
        'application.job_posting',
        'application.requirements',
        'application.skills',
        'application.job_posting_url',
        'application.job_posting_word_count',
        'application.salary_quoted',
        'application.salary_accepted',
        'application.salary_expected',
        'application.salary_requested',
        'application.salary_offered',
        'application.salary_negotiated',
        'application.salary_final',
        'application.total_comp_offered',
        'application.total_comp_final',
        'application.equity_offered',
        'application.equity_final',
        'application.bonus_offered',
        'application.bonus_final',
        'application.source',
        'application.application_date',
        'application.response_date',
        'application.first_interview_date',
        'application.offer_date',
        'application.decision_date',
        'application.rejection_reason',
        'application.withdrawal_reason',
        'application.time_to_response',
        'application.time_to_first_interview',
        'application.time_to_offer',
        'application.time_to_decision',
        'application.cover_letter',
        'application.resume',
        'application.job_id',
        'application.link',
        'application.phone_screen',
        'application.reference',
        'application.interview_dates',
        'application.company_notes',
        'application.negotiation_notes',
        'application.recruiter_name',
        'application.recruiter_email',
        'application.recruiter_linkedin',
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
      .where('application.owner_userid', '=', userId)
      .executeTakeFirst();

    if (!applicationData) {
      throw new Error('Application not found');
    }

    const notesResult = await db
      .selectFrom('app.application_notes')
      .selectAll()
      .where('application_id', '=', applicationId)
      .orderBy('createdat', 'asc')
      .execute();

    const company = applicationData.companyId
      ? ({
          id: applicationData.companyId,
          ownerUserId: '',
          name: applicationData.companyName || '',
          website: applicationData.companyWebsite,
          industry: applicationData.companyIndustry,
          size: applicationData.companySize,
          location: applicationData.companyLocation,
          description: applicationData.companyDescription,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Company)
      : null;

    const application = {
      id: applicationData.id,
      userId: applicationData.owner_userid,
      position: applicationData.position,
      companyId: applicationData.company_id,
      status: applicationData.status,
      startDate: applicationData.start_date ? new Date(applicationData.start_date) : new Date(),
      endDate: applicationData.end_date ? new Date(applicationData.end_date) : null,
      location: applicationData.location,
      jobPosting: applicationData.job_posting,
      requirements: Array.isArray(applicationData.requirements) ? applicationData.requirements : [],
      skills: Array.isArray(applicationData.skills) ? applicationData.skills : [],
      jobPostingUrl: applicationData.job_posting_url,
      jobPostingWordCount: applicationData.job_posting_word_count,
      salaryQuoted: applicationData.salary_quoted,
      salaryAccepted: applicationData.salary_accepted,
      salaryExpected: applicationData.salary_expected,
      salaryRequested: applicationData.salary_requested,
      salaryOffered: applicationData.salary_offered,
      salaryNegotiated: applicationData.salary_negotiated,
      salaryFinal: applicationData.salary_final,
      totalCompOffered: applicationData.total_comp_offered,
      totalCompFinal: applicationData.total_comp_final,
      equityOffered: applicationData.equity_offered,
      equityFinal: applicationData.equity_final,
      bonusOffered: applicationData.bonus_offered,
      bonusFinal: applicationData.bonus_final,
      source: applicationData.source,
      applicationDate: applicationData.application_date
        ? new Date(applicationData.application_date)
        : null,
      responseDate: applicationData.response_date ? new Date(applicationData.response_date) : null,
      firstInterviewDate: applicationData.first_interview_date
        ? new Date(applicationData.first_interview_date)
        : null,
      offerDate: applicationData.offer_date ? new Date(applicationData.offer_date) : null,
      decisionDate: applicationData.decision_date ? new Date(applicationData.decision_date) : null,
      rejectionReason: applicationData.rejection_reason,
      withdrawalReason: applicationData.withdrawal_reason,
      timeToResponse: applicationData.time_to_response,
      timeToFirstInterview: applicationData.time_to_first_interview,
      timeToOffer: applicationData.time_to_offer,
      timeToDecision: applicationData.time_to_decision,
      coverLetter: applicationData.cover_letter,
      resume: applicationData.resume,
      jobId: applicationData.job_id,
      link: applicationData.link,
      phoneScreen: applicationData.phone_screen,
      reference: applicationData.reference,
      interviewDates: Array.isArray(applicationData.interview_dates)
        ? (applicationData.interview_dates as unknown as InterviewEntry[])
        : [],
      companyNotes: applicationData.company_notes,
      negotiationNotes: applicationData.negotiation_notes,
      recruiterName: applicationData.recruiter_name,
      recruiterEmail: applicationData.recruiter_email,
      recruiterLinkedin: applicationData.recruiter_linkedin,
      stages: Array.isArray(applicationData.stages) ? applicationData.stages : [],
      createdAt: applicationData.createdat ? new Date(applicationData.createdat) : new Date(),
      updatedAt: applicationData.updatedat ? new Date(applicationData.updatedat) : new Date(),
      company,
    } as unknown as ApplicationWithCompany;

    const notes = notesResult.map(
      (note) =>
        ({
          id: note.id,
          applicationId: note.application_id,
          type: note.type,
          title: note.title,
          content: note.content,
          isPrivate: note.is_private,
          createdAt: note.createdat ? new Date(note.createdat) : new Date(),
          updatedAt: note.updatedat ? new Date(note.updatedat) : new Date(),
        }) as ApplicationNote,
    );

    return {
      application,
      notes,
      files: [],
    };
  }

  /**
   * Verify application ownership
   */
  static async verifyOwnership(applicationId: string, userId: string): Promise<boolean> {
    const application = await getDb()
      .selectFrom('app.job_applications')
      .select('id')
      .where('id', '=', applicationId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    return Boolean(application);
  }

  /**
   * Update application details
   */
  static async updateApplication(
    applicationId: string,
    updates: JobApplicationUpdate,
    userId?: string,
  ): Promise<void> {
    if (Object.keys(updates).length === 0) {
      return;
    }

    let query = getDb()
      .updateTable('app.job_applications')
      .set({
        ...(updates.position !== undefined ? { position: updates.position } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.location !== undefined ? { location: updates.location } : {}),
        ...(updates.jobPosting !== undefined ? { job_posting: updates.jobPosting } : {}),
        ...(updates.salaryQuoted !== undefined ? { salary_quoted: updates.salaryQuoted } : {}),
        ...(updates.salaryAccepted !== undefined
          ? { salary_accepted: updates.salaryAccepted }
          : {}),
        ...(updates.companyNotes !== undefined ? { company_notes: updates.companyNotes } : {}),
        ...(updates.negotiationNotes !== undefined
          ? { negotiation_notes: updates.negotiationNotes }
          : {}),
        ...(updates.recruiterName !== undefined ? { recruiter_name: updates.recruiterName } : {}),
        ...(updates.recruiterEmail !== undefined
          ? { recruiter_email: updates.recruiterEmail }
          : {}),
        ...(updates.recruiterLinkedin !== undefined
          ? { recruiter_linkedin: updates.recruiterLinkedin }
          : {}),
      })
      .where('id', '=', applicationId);

    if (userId) {
      query = query.where('owner_userid', '=', userId);
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
    await getDb()
      .insertInto('app.application_notes')
      .values({
        application_id: applicationId,
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
    await getDb().deleteFrom('app.application_notes').where('id', '=', noteId).execute();
  }

  /**
   * Add an interview to an application
   */
  static async addInterview(applicationId: string, interview: InterviewEntry): Promise<void> {
    const currentApplication = await getDb()
      .selectFrom('app.job_applications')
      .select('interview_dates')
      .where('id', '=', applicationId)
      .executeTakeFirst();

    const currentInterviews = Array.isArray(currentApplication?.interview_dates)
      ? (currentApplication.interview_dates as unknown as InterviewEntry[])
      : [];

    await getDb()
      .updateTable('app.job_applications')
      .set({
        interview_dates: [...currentInterviews, interview] as unknown as never,
      })
      .where('id', '=', applicationId)
      .executeTakeFirstOrThrow();
  }

  /**
   * Get application by ID for ownership verification
   */
  static async getApplicationById(applicationId: string, userId: string) {
    const application = await getDb()
      .selectFrom('app.job_applications')
      .selectAll()
      .where('id', '=', applicationId)
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    return application || null;
  }

  static async createApplication(
    userId: string,
    input: CreateApplicationInput,
  ): Promise<CareerJobApplicationRecord> {
    const db = getDb();

    const company = await CareerRepository.findOrCreateCompany(db, userId, {
      name: input.companyName,
      website: input.companyWebsite ?? null,
      description: input.companyDescription ?? null,
    });

    return CareerRepository.createJobApplication(db, userId, {
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
