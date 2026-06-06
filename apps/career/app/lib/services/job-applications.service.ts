import { CareerRepository, db } from '@hominem/db';
import type {
  CareerCompanyRecord as Company,
  CareerJobApplicationRecord,
  JsonObject,
  JsonValue,
} from '@hominem/db';

import { JobApplicationStage, JobApplicationStatus } from '~/types/career';
import type {
  ApplicationFile,
  ApplicationNote,
  ApplicationWithCompany,
  InterviewEntry,
  JobApplicationUpdate,
} from '~/types/career-data';

export interface CreateApplicationInput {
  companyName: string;
  companyWebsite?: string | null;
  companyDescription?: string | null;
  position: string;
  status?: JobApplicationStatus;
  start_date?: Date;
  location?: string | null;
  job_posting?: string | null;
  requirements?: string[];
  skills?: string[];
  job_posting_url?: string | null;
  job_posting_word_count?: number | null;
  salary_quoted?: string | null;
  recruiter_name?: string | null;
  recruiter_email?: string | null;
  recruiter_linkedin?: string | null;
  source?: string | null;
  link?: string | null;
}

export interface ApplicationDetailData {
  application: ApplicationWithCompany;
  notes: ApplicationNote[];
  files: ApplicationFile[];
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
    owner_userid: string,
  ): Promise<ApplicationDetailData> {
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
        'company.id as company_id',
        'company.name as companyName',
        'company.website as companyWebsite',
        'company.industry as companyIndustry',
        'company.size as companySize',
        'company.location as companyLocation',
        'company.description as companyDescription',
      ])
      .where('application.id', '=', applicationId)
      .where('application.owner_userid', '=', owner_userid)
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

    const company = applicationData.company_id
      ? ({
          id: applicationData.company_id,
          owner_userid: '',
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
      owner_userid: applicationData.owner_userid,
      position: applicationData.position,
      company_id: applicationData.company_id,
      status: applicationData.status,
      start_date: applicationData.start_date ? new Date(applicationData.start_date) : new Date(),
      end_date: applicationData.end_date ? new Date(applicationData.end_date) : null,
      location: applicationData.location,
      job_posting: applicationData.job_posting,
      requirements: Array.isArray(applicationData.requirements) ? applicationData.requirements : [],
      skills: Array.isArray(applicationData.skills) ? applicationData.skills : [],
      job_posting_url: applicationData.job_posting_url,
      job_posting_word_count: applicationData.job_posting_word_count,
      salary_quoted: applicationData.salary_quoted,
      salary_accepted: applicationData.salary_accepted,
      salary_expected: applicationData.salary_expected,
      salary_requested: applicationData.salary_requested,
      salary_offered: applicationData.salary_offered,
      salary_negotiated: applicationData.salary_negotiated,
      salary_final: applicationData.salary_final,
      total_comp_offered: applicationData.total_comp_offered,
      total_comp_final: applicationData.total_comp_final,
      equity_offered: applicationData.equity_offered,
      equity_final: applicationData.equity_final,
      bonus_offered: applicationData.bonus_offered,
      bonus_final: applicationData.bonus_final,
      source: applicationData.source,
      application_date: applicationData.application_date
        ? new Date(applicationData.application_date)
        : null,
      response_date: applicationData.response_date ? new Date(applicationData.response_date) : null,
      first_interview_date: applicationData.first_interview_date
        ? new Date(applicationData.first_interview_date)
        : null,
      offer_date: applicationData.offer_date ? new Date(applicationData.offer_date) : null,
      decision_date: applicationData.decision_date ? new Date(applicationData.decision_date) : null,
      rejection_reason: applicationData.rejection_reason,
      withdrawal_reason: applicationData.withdrawal_reason,
      time_to_response: applicationData.time_to_response,
      time_to_first_interview: applicationData.time_to_first_interview,
      time_to_offer: applicationData.time_to_offer,
      time_to_decision: applicationData.time_to_decision,
      cover_letter: applicationData.cover_letter,
      resume: applicationData.resume,
      jobId: applicationData.job_id,
      link: applicationData.link,
      phone_screen: applicationData.phone_screen,
      reference: applicationData.reference,
      interview_dates: Array.isArray(applicationData.interview_dates)
        ? (applicationData.interview_dates as unknown as InterviewEntry[])
        : [],
      company_notes: applicationData.company_notes,
      negotiation_notes: applicationData.negotiation_notes,
      recruiter_name: applicationData.recruiter_name,
      recruiter_email: applicationData.recruiter_email,
      recruiter_linkedin: applicationData.recruiter_linkedin,
      stages: Array.isArray(applicationData.stages) ? applicationData.stages : [],
      createdat: applicationData.createdat ? new Date(applicationData.createdat) : new Date(),
      updatedat: applicationData.updatedat ? new Date(applicationData.updatedat) : new Date(),
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
          createdat: note.createdat ? new Date(note.createdat) : new Date(),
          updatedat: note.updatedat ? new Date(note.updatedat) : new Date(),
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
  static async verifyOwnership(applicationId: string, owner_userid: string): Promise<boolean> {
    const application = await db
      .selectFrom('app.job_applications')
      .select('id')
      .where('id', '=', applicationId)
      .where('owner_userid', '=', owner_userid)
      .executeTakeFirst();

    return Boolean(application);
  }

  /**
   * Update application details
   */
  static async updateApplication(
    applicationId: string,
    updates: JobApplicationUpdate,
    owner_userid?: string,
  ): Promise<void> {
    if (Object.keys(updates).length === 0) {
      return;
    }

    let query = db
      .updateTable('app.job_applications')
      .set({
        ...(updates.position !== undefined ? { position: updates.position } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.location !== undefined ? { location: updates.location } : {}),
        ...(updates.job_posting !== undefined ? { job_posting: updates.job_posting } : {}),
        ...(updates.salary_quoted !== undefined ? { salary_quoted: updates.salary_quoted } : {}),
        ...(updates.salary_accepted !== undefined
          ? { salary_accepted: updates.salary_accepted }
          : {}),
        ...(updates.company_notes !== undefined ? { company_notes: updates.company_notes } : {}),
        ...(updates.negotiation_notes !== undefined
          ? { negotiation_notes: updates.negotiation_notes }
          : {}),
        ...(updates.recruiter_name !== undefined ? { recruiter_name: updates.recruiter_name } : {}),
        ...(updates.recruiter_email !== undefined
          ? { recruiter_email: updates.recruiter_email }
          : {}),
        ...(updates.recruiter_linkedin !== undefined
          ? { recruiter_linkedin: updates.recruiter_linkedin }
          : {}),
      })
      .where('id', '=', applicationId);

    if (owner_userid) {
      query = query.where('owner_userid', '=', owner_userid);
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
    await db.deleteFrom('app.application_notes').where('id', '=', noteId).execute();
  }

  /**
   * Add an interview to an application
   */
  static async addInterview(applicationId: string, interview: InterviewEntry): Promise<void> {
    const currentApplication = await db
      .selectFrom('app.job_applications')
      .select('interview_dates')
      .where('id', '=', applicationId)
      .executeTakeFirst();

    const currentInterviews = Array.isArray(currentApplication?.interview_dates)
      ? (currentApplication.interview_dates as unknown as InterviewEntry[])
      : [];

    await db
      .updateTable('app.job_applications')
      .set({
        interview_dates: [...currentInterviews, interview].map(interviewEntryToJson) as JsonValue,
      })
      .where('id', '=', applicationId)
      .executeTakeFirstOrThrow();
  }

  /**
   * Get application by ID for ownership verification
   */
  static async getApplicationById(applicationId: string, owner_userid: string) {
    const application = await db
      .selectFrom('app.job_applications')
      .selectAll()
      .where('id', '=', applicationId)
      .where('owner_userid', '=', owner_userid)
      .executeTakeFirst();

    return application || null;
  }

  static async createApplication(
    owner_userid: string,
    input: CreateApplicationInput,
  ): Promise<CareerJobApplicationRecord> {
    const company = await CareerRepository.findOrCreateCompany(db, owner_userid, {
      name: input.companyName,
      website: input.companyWebsite ?? null,
      description: input.companyDescription ?? null,
    });

    return CareerRepository.createJobApplication(db, owner_userid, {
      company_id: company.id,
      position: input.position,
      status: input.status ?? JobApplicationStatus.APPLIED,
      start_date: input.start_date ?? new Date(),
      location: input.location ?? null,
      job_posting: input.job_posting ?? null,
      requirements: input.requirements ?? [],
      skills: input.skills ?? [],
      job_posting_url: input.job_posting_url ?? null,
      job_posting_word_count: input.job_posting_word_count ?? null,
      salary_quoted: input.salary_quoted ?? null,
      recruiter_name: input.recruiter_name ?? null,
      recruiter_email: input.recruiter_email ?? null,
      recruiter_linkedin: input.recruiter_linkedin ?? null,
      source: input.source ?? null,
      link: input.link ?? null,
      reference: false,
      stages: [{ stage: JobApplicationStage.APPLICATION, date: new Date().toISOString() }],
    });
  }
}
