import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type { AppJobApplications, JsonValue } from '../../types/database';
import { toCompanyRecord, type CompanyRecord, type CompanyRow } from './company.repository';

type JobApplicationRow = Selectable<AppJobApplications>;

function serializeJsonColumn(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

export interface CareerApplicationStage {
  stage: string;
  date: string;
  notes?: string;
}

export interface CareerInterviewEntry {
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'final';
  date: string;
  duration?: number;
  interviewer?: string;
  notes?: string;
}

export interface JobApplicationRecord {
  id: string;
  ownerUserid: string;
  companyId: string;
  jobId: string | null;
  position: string;
  status: string;
  startDate: string;
  endDate: string | null;
  location: string | null;
  jobPosting: string | null;
  jobPostingUrl: string | null;
  jobPostingWordCount: number | null;
  requirements: JsonValue;
  skills: JsonValue;
  salaryQuoted: string | null;
  salaryAccepted: string | null;
  salaryExpected: number | null;
  salaryRequested: number | null;
  salaryOffered: number | null;
  salaryNegotiated: number | null;
  salaryFinal: number | null;
  totalCompOffered: number | null;
  totalCompFinal: number | null;
  bonusOffered: number | null;
  bonusFinal: number | null;
  equityOffered: string | null;
  equityFinal: string | null;
  source: string | null;
  link: string | null;
  applicationDate: string | null;
  responseDate: string | null;
  firstInterviewDate: string | null;
  offerDate: string | null;
  decisionDate: string | null;
  timeToResponse: number | null;
  timeToFirstInterview: number | null;
  timeToOffer: number | null;
  timeToDecision: number | null;
  companyNotes: string | null;
  negotiationNotes: string | null;
  rejectionReason: string | null;
  withdrawalReason: string | null;
  phoneScreen: string | null;
  coverLetter: string | null;
  reference: boolean;
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterLinkedin: string | null;
  resume: string | null;
  stages: JsonValue;
  interviewDates: JsonValue;
  createdat: string;
  updatedat: string;
  company: CompanyRecord | null;
}

export interface CreateJobApplicationInput {
  companyId: string;
  position: string;
  status: string;
  startDate: Date | string;
  endDate?: Date | string | null;
  location?: string | null;
  jobPosting?: string | null;
  requirements?: string[];
  skills?: string[];
  jobPostingUrl?: string | null;
  jobPostingWordCount?: number | null;
  salaryQuoted?: string | null;
  salaryAccepted?: string | null;
  salaryOffered?: number | null;
  salaryFinal?: number | null;
  source?: string | null;
  applicationDate?: Date | string | null;
  link?: string | null;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  recruiterLinkedin?: string | null;
  reference?: boolean;
  stages?: CareerApplicationStage[];
  interviewDates?: CareerInterviewEntry[];
}

export interface UpdateJobApplicationInput {
  position?: string;
  status?: string;
  location?: string | null;
  jobPosting?: string | null;
  jobPostingUrl?: string | null;
  source?: string | null;
  link?: string | null;
  startDate?: Date | string;
  applicationDate?: Date | string | null;
  responseDate?: Date | string | null;
  firstInterviewDate?: Date | string | null;
  offerDate?: Date | string | null;
  decisionDate?: Date | string | null;
  endDate?: Date | string | null;
  salaryQuoted?: string | null;
  salaryAccepted?: string | null;
  salaryExpected?: number | null;
  salaryRequested?: number | null;
  salaryOffered?: number | null;
  salaryNegotiated?: number | null;
  salaryFinal?: number | null;
  totalCompOffered?: number | null;
  totalCompFinal?: number | null;
  bonusOffered?: number | null;
  bonusFinal?: number | null;
  equityOffered?: string | null;
  equityFinal?: string | null;
  companyNotes?: string | null;
  negotiationNotes?: string | null;
  rejectionReason?: string | null;
  withdrawalReason?: string | null;
  phoneScreen?: string | null;
  reference?: boolean;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  recruiterLinkedin?: string | null;
  resume?: string | null;
  companyId?: string;
  updatedat?: Date;
}

export interface CreateJobApplicationCommand extends CreateJobApplicationInput {
  ownerUserid: string;
}

export interface UpdateJobApplicationStatusCommand {
  ownerUserid: string;
  applicationId: string;
  status: string;
}

export interface DeleteJobApplicationCommand {
  ownerUserid: string;
  applicationId: string;
}

function toJobApplicationRecord(
  row: JobApplicationRow,
  company: CompanyRow | null,
): JobApplicationRecord {
  return {
    id: row.id,
    ownerUserid: row.ownerUserid,
    companyId: row.companyId,
    jobId: row.jobId,
    position: row.position,
    status: row.status,
    startDate: String(row.startDate),
    endDate: row.endDate ? String(row.endDate) : null,
    location: row.location,
    jobPosting: row.jobPosting,
    jobPostingUrl: row.jobPostingUrl,
    jobPostingWordCount: row.jobPostingWordCount,
    requirements: row.requirements,
    skills: row.skills,
    salaryQuoted: row.salaryQuoted,
    salaryAccepted: row.salaryAccepted,
    salaryExpected: row.salaryExpected,
    salaryRequested: row.salaryRequested,
    salaryOffered: row.salaryOffered,
    salaryNegotiated: row.salaryNegotiated,
    salaryFinal: row.salaryFinal,
    totalCompOffered: row.totalCompOffered,
    totalCompFinal: row.totalCompFinal,
    bonusOffered: row.bonusOffered,
    bonusFinal: row.bonusFinal,
    equityOffered: row.equityOffered,
    equityFinal: row.equityFinal,
    source: row.source,
    link: row.link,
    applicationDate: row.applicationDate ? String(row.applicationDate) : null,
    responseDate: row.responseDate ? String(row.responseDate) : null,
    firstInterviewDate: row.firstInterviewDate ? String(row.firstInterviewDate) : null,
    offerDate: row.offerDate ? String(row.offerDate) : null,
    decisionDate: row.decisionDate ? String(row.decisionDate) : null,
    timeToResponse: row.timeToResponse,
    timeToFirstInterview: row.timeToFirstInterview,
    timeToOffer: row.timeToOffer,
    timeToDecision: row.timeToDecision,
    companyNotes: row.companyNotes,
    negotiationNotes: row.negotiationNotes,
    rejectionReason: row.rejectionReason,
    withdrawalReason: row.withdrawalReason,
    phoneScreen: row.phoneScreen,
    coverLetter: row.coverLetter,
    reference: row.reference,
    recruiterName: row.recruiterName,
    recruiterEmail: row.recruiterEmail,
    recruiterLinkedin: row.recruiterLinkedin,
    resume: row.resume,
    stages: row.stages,
    interviewDates: row.interviewDates,
    createdat: String(row.createdat),
    updatedat: String(row.updatedat),
    company: company ? toCompanyRecord(company) : null,
  };
}

export const JobApplicationRepository = {
  async createJobApplication(
    handle: DbHandle,
    input: CreateJobApplicationCommand,
  ): Promise<JobApplicationRecord> {
    const company = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('id', '=', input.companyId)
      .where('ownerUserid', '=', input.ownerUserid)
      .executeTakeFirst();

    if (!company) {
      throw new NotFoundError('Company', {
        companyId: input.companyId,
        ownerUserid: input.ownerUserid,
      });
    }

    const created = await handle
      .insertInto('app.jobApplications')
      .values({
        ownerUserid: input.ownerUserid,
        companyId: input.companyId,
        position: input.position,
        status: input.status,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        location: input.location ?? null,
        jobPosting: input.jobPosting ?? null,
        requirements: serializeJsonColumn(input.requirements ?? []),
        skills: serializeJsonColumn(input.skills ?? []),
        jobPostingUrl: input.jobPostingUrl ?? null,
        jobPostingWordCount: input.jobPostingWordCount ?? null,
        salaryQuoted: input.salaryQuoted ?? null,
        salaryAccepted: input.salaryAccepted ?? null,
        salaryOffered: input.salaryOffered ?? null,
        salaryFinal: input.salaryFinal ?? null,
        source: input.source ?? null,
        applicationDate: input.applicationDate ? new Date(input.applicationDate) : null,
        link: input.link ?? null,
        recruiterName: input.recruiterName ?? null,
        recruiterEmail: input.recruiterEmail ?? null,
        recruiterLinkedin: input.recruiterLinkedin ?? null,
        reference: input.reference ?? false,
        stages: serializeJsonColumn(input.stages ?? []),
        interviewDates: serializeJsonColumn(input.interviewDates ?? []),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toJobApplicationRecord(created as JobApplicationRow, company as CompanyRow);
  },

  async updateJobApplicationStatus(
    handle: DbHandle,
    command: UpdateJobApplicationStatusCommand,
  ): Promise<void> {
    const updated = await handle
      .updateTable('app.jobApplications')
      .set({ status: command.status })
      .where('id', '=', command.applicationId)
      .where('ownerUserid', '=', command.ownerUserid)
      .returning('id')
      .executeTakeFirst();

    if (!updated)
      throw new NotFoundError('JobApplication', { applicationId: command.applicationId });
  },

  async deleteJobApplication(
    handle: DbHandle,
    command: DeleteJobApplicationCommand,
  ): Promise<void> {
    const deleted = await handle
      .deleteFrom('app.jobApplications')
      .where('id', '=', command.applicationId)
      .where('ownerUserid', '=', command.ownerUserid)
      .returning('id')
      .executeTakeFirst();

    if (!deleted)
      throw new NotFoundError('JobApplication', { applicationId: command.applicationId });
  },

  async getApplicationById(
    handle: DbHandle,
    ownerUserid: string,
    applicationId: string,
  ): Promise<JobApplicationRecord | null> {
    const application = await handle
      .selectFrom('app.jobApplications')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .where('id', '=', applicationId)
      .executeTakeFirst();

    if (!application) return null;

    const company = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('id', '=', application.companyId)
      .executeTakeFirst();

    return toJobApplicationRecord(
      application as JobApplicationRow,
      (company as CompanyRow | undefined) ?? null,
    );
  },

  async listUserJobApplicationsWithCompany(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<JobApplicationRecord[]> {
    const results = await handle
      .selectFrom('app.jobApplications as ja')
      .leftJoin('app.companies as c', 'c.id', 'ja.companyId')
      .selectAll('ja')
      .select([
        'c.id as company__id',
        'c.ownerUserid as company__ownerUserid',
        'c.name as company__name',
        'c.website as company__website',
        'c.industry as company__industry',
        'c.size as company__size',
        'c.location as company__location',
        'c.description as company__description',
        'c.createdat as company__createdat',
        'c.updatedat as company__updatedat',
      ])
      .where('ja.ownerUserid', '=', ownerUserid)
      .orderBy('ja.applicationDate', 'desc')
      .execute();

    return results.map((row) => {
      const company = row.company__id
        ? ({
            id: row.company__id,
            ownerUserid: row.company__ownerUserid,
            name: row.company__name,
            website: row.company__website,
            industry: row.company__industry,
            size: row.company__size,
            location: row.company__location,
            description: row.company__description,
            createdat: row.company__createdat,
            updatedat: row.company__updatedat,
          } as CompanyRow)
        : null;
      return toJobApplicationRecord(row as JobApplicationRow, company);
    });
  },
};
