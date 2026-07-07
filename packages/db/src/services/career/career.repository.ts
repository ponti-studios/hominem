import { sql } from 'kysely';
import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type {
  AppCareerEvents,
  AppCertifications,
  AppCompanies,
  AppJobApplications,
  AppPortfolios,
  AppProjects,
  AppSkills,
  AppSocialLinks,
  AppTestimonials,
  AppUserPortfolioPreferences,
  AppWorkExperiences,
} from '../../types/database';

type PortfolioRow = Selectable<AppPortfolios>;
type SocialLinksRow = Selectable<AppSocialLinks>;
type WorkExperienceRow = Selectable<AppWorkExperiences>;
type SkillRow = Selectable<AppSkills>;
type ProjectRow = Selectable<AppProjects>;
type TestimonialRow = Selectable<AppTestimonials>;
type UserPortfolioPreferenceRow = Selectable<AppUserPortfolioPreferences>;
type CompanyRow = Selectable<AppCompanies>;
type JobApplicationRow = Selectable<AppJobApplications>;
type CareerEventRow = Selectable<AppCareerEvents>;

function serializeJsonColumn(value: unknown): string | null {
  return value === null ? null : JSON.stringify(value);
}

export interface CareerPortfolioTheme {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
}

export interface CareerSalaryRange {
  min: number;
  max: number;
  currency: string;
}

export interface CareerBonusHistoryEntry {
  type: 'annual' | 'signing' | 'performance' | 'retention' | 'spot';
  amount: number;
  date: string;
  description?: string;
}

export interface CareerWorkExperienceBenefits {
  healthInsurance?: boolean;
  dental?: boolean;
  vision?: boolean;
  retirement401k?: number;
  retirementVesting?: string;
  paidTimeOff?: number;
  sickLeave?: number;
  parentalLeave?: number;
  stockOptions?: boolean;
  stockPurchasePlan?: boolean;
  flexibleSchedule?: boolean;
  remoteWork?: boolean;
  gymMembership?: boolean;
  tuitionReimbursement?: number;
  professionalDevelopment?: number;
  commuter?: number;
  meals?: string;
  other?: string[];
}

export interface CareerPerformanceRating {
  period: string;
  rating: string;
  score?: number;
  feedback?: string;
  goals?: string[];
}

export interface CareerSalaryAdjustment {
  effectiveDate: string;
  previousSalary: number;
  newSalary: number;
  increaseAmount: number;
  increasePercentage: number;
  reason: 'promotion' | 'merit_increase' | 'market_adjustment' | 'cost_of_living' | 'role_change';
  newTitle?: string;
  notes?: string;
  company: string;
  workExperienceId: string;
}

export interface CareerInterviewEntry {
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'final';
  date: string;
  duration?: number;
  interviewer?: string;
  notes?: string;
}

export interface CareerApplicationStage {
  stage: string;
  date: string;
  notes?: string;
}

export type CareerPortfolioRecord = PortfolioRow;
export type CareerSocialLinksRecord = SocialLinksRow;
export type CareerWorkExperienceRecord = WorkExperienceRow;
export type CareerSkillRecord = SkillRow;
export type CareerProjectRecord = ProjectRow;
export type CareerTestimonialRecord = TestimonialRow;

export interface CareerFullPortfolioRecord extends CareerPortfolioRecord {
  social_links: CareerSocialLinksRecord | null;
  work_experiences: CareerWorkExperienceRecord[];
  skills: CareerSkillRecord[];
  projects: CareerProjectRecord[];
  testimonials: CareerTestimonialRecord[];
}

export type CareerCompanyRecord = CompanyRow;

export interface CareerJobApplicationRecord extends JobApplicationRow {
  company: CareerCompanyRecord | null;
}

export type CareerEventRecord = CareerEventRow;
export type CareerCertificationRecord = Selectable<AppCertifications>;

export interface CreateDefaultCareerPortfolioInput {
  ownerUserid: string;
  email: string;
  name: string;
}

export interface UpdateCareerWorkExperienceInput {
  role?: string;
  company?: string;
  description?: string;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  action?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  sortOrder?: number;
  isVisible?: boolean;
  // financial
  baseSalary?: number | null;
  signingBonus?: number | null;
  annualBonus?: number | null;
  // role details
  employmentType?: string | null;
  workArrangement?: string | null;
  seniorityLevel?: string | null;
  department?: string | null;
  teamSize?: number | null;
  directReports?: number | null;
  reportsTo?: string | null;
  // exit
  reasonForLeaving?: string | null;
  exitNotes?: string | null;
}

export interface UpdateCareerJobApplicationInput {
  position?: string;
  status?: string;
  location?: string | null;
  jobPosting?: string | null;
  salaryQuoted?: string | null;
  salaryAccepted?: string | null;
  companyNotes?: string | null;
  negotiationNotes?: string | null;
  recruiterName?: string | null;
  recruiterEmail?: string | null;
  recruiterLinkedin?: string | null;
  resume?: string | null;
  updatedat?: Date;
}

function toJobApplicationRecord(
  row: JobApplicationRow,
  company: CompanyRow | null,
): CareerJobApplicationRecord {
  return {
    ...row,
    company,
  };
}

async function loadFullPortfolio(
  handle: DbHandle,
  portfolio: CareerPortfolioRecord,
): Promise<CareerFullPortfolioRecord> {
  const [social_links, work_experiences, skills, projects, testimonials] = await Promise.all([
    handle
      .selectFrom('app.socialLinks')
      .selectAll()
      .where('portfolioId', '=', portfolio.id)
      .executeTakeFirst(),
    handle
      .selectFrom('app.workExperiences')
      .selectAll()
      .where('portfolioId', '=', portfolio.id)
      .orderBy(sql`startDate asc nulls last`)
      .execute(),
    handle
      .selectFrom('app.skills')
      .selectAll()
      .where('portfolioId', '=', portfolio.id)
      .orderBy('sortOrder', 'asc')
      .execute(),
    handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolio.id)
      .orderBy('sortOrder', 'asc')
      .execute(),
    handle
      .selectFrom('app.testimonials')
      .selectAll()
      .where('portfolioId', '=', portfolio.id)
      .orderBy('sortOrder', 'asc')
      .execute(),
  ]);

  return {
    ...portfolio,
    social_links: (social_links as SocialLinksRow | undefined) ?? null,
    work_experiences: work_experiences as WorkExperienceRow[],
    skills: skills as SkillRow[],
    projects: projects as ProjectRow[],
    testimonials: testimonials as TestimonialRow[],
  };
}

function createPortfolioSlug(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'portfolio'}-${suffix}`;
}

async function getOwnedPortfolioRow(handle: DbHandle, ownerUserid: string, portfolioId: string) {
  return handle
    .selectFrom('app.portfolios')
    .selectAll()
    .where('id', '=', portfolioId)
    .where('ownerUserid', '=', ownerUserid)
    .executeTakeFirst();
}

async function getOwnedPortfolioRowOrThrow(
  handle: DbHandle,
  ownerUserid: string,
  portfolioId: string,
) {
  const portfolio = await getOwnedPortfolioRow(handle, ownerUserid, portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio', { portfolioId, ownerUserid });
  }
  return portfolio as PortfolioRow;
}

async function getCurrentPortfolioPreference(
  handle: DbHandle,
  ownerUserid: string,
): Promise<UserPortfolioPreferenceRow | null> {
  const preference = await handle
    .selectFrom('app.userPortfolioPreferences')
    .selectAll()
    .where('userId', '=', ownerUserid)
    .executeTakeFirst();

  return (preference as UserPortfolioPreferenceRow | undefined) ?? null;
}

async function resolveCurrentPortfolioRow(
  handle: DbHandle,
  ownerUserid: string,
): Promise<PortfolioRow | null> {
  const preference = await getCurrentPortfolioPreference(handle, ownerUserid);

  if (preference?.currentPortfolioId) {
    const preferredPortfolio = await getOwnedPortfolioRow(
      handle,
      ownerUserid,
      preference.currentPortfolioId,
    );
    if (preferredPortfolio) {
      return preferredPortfolio as PortfolioRow;
    }
  }

  const fallbackPortfolio = await handle
    .selectFrom('app.portfolios')
    .selectAll()
    .where('ownerUserid', '=', ownerUserid)
    .orderBy('createdat', 'desc')
    .executeTakeFirst();

  return (fallbackPortfolio as PortfolioRow | undefined) ?? null;
}

export const CareerRepository = {
  async getPortfolioByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<CareerPortfolioRecord | null> {
    const portfolio = await resolveCurrentPortfolioRow(handle, ownerUserid);

    return portfolio;
  },

  async listPortfoliosByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<CareerPortfolioRecord[]> {
    const portfolios = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .orderBy('createdat', 'desc')
      .execute();

    return portfolios as PortfolioRow[];
  },

  async getCurrentPortfolioIdByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<string | null> {
    const preference = await getCurrentPortfolioPreference(handle, ownerUserid);
    return preference?.currentPortfolioId ?? null;
  },

  async setCurrentPortfolioByUserId(
    handle: DbHandle,
    ownerUserid: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .insertInto('app.userPortfolioPreferences')
      .values({
        userId: ownerUserid,
        currentPortfolioId: portfolioId,
      })
      .onConflict((oc) =>
        oc.column('userId').doUpdateSet({
          currentPortfolioId: portfolioId,
          updatedat: new Date(),
        }),
      )
      .execute();
  },

  async getPortfolioBySlug(handle: DbHandle, slug: string): Promise<CareerPortfolioRecord | null> {
    const portfolio = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where(sql<string>`lower(slug)`, '=', slug.toLowerCase())
      .executeTakeFirst();

    return (portfolio as PortfolioRow | undefined) ?? null;
  },

  async loadFullPortfolioByUserId(
    handle: DbHandle,
    ownerUserid: string,
  ): Promise<CareerFullPortfolioRecord | null> {
    const portfolio = await CareerRepository.getPortfolioByUserId(handle, ownerUserid);
    return portfolio ? loadFullPortfolio(handle, portfolio) : null;
  },

  async loadFullPortfolioBySlug(
    handle: DbHandle,
    slug: string,
  ): Promise<CareerFullPortfolioRecord | null> {
    const portfolio = await CareerRepository.getPortfolioBySlug(handle, slug);
    if (!portfolio || !portfolio.isPublic || !portfolio.isActive) {
      return null;
    }
    return loadFullPortfolio(handle, portfolio);
  },

  async isSlugAvailable(
    handle: DbHandle,
    slug: string,
    currentPortfolioId?: string,
  ): Promise<boolean> {
    let query = handle
      .selectFrom('app.portfolios')
      .select('id')
      .where(sql<string>`lower(slug)`, '=', slug.toLowerCase());

    if (currentPortfolioId) {
      query = query.where('id', '!=', currentPortfolioId);
    }

    const existing = await query.executeTakeFirst();
    return !existing;
  },

  async createDefaultPortfolio(
    handle: DbHandle,
    input: CreateDefaultCareerPortfolioInput,
  ): Promise<CareerPortfolioRecord> {
    const created = await handle
      .insertInto('app.portfolios')
      .values({
        ownerUserid: input.ownerUserid,
        slug: createPortfolioSlug(input.name),
        title: `${input.name}'s Portfolio`,
        name: input.name,
        jobTitle: 'Software Engineer',
        bio: 'Welcome to my portfolio!',
        tagline: 'Building the future of software',
        currentLocation: 'San Francisco, CA',
        email: input.email,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as PortfolioRow;
  },

  async deletePortfolioByUserId(handle: DbHandle, ownerUserid: string): Promise<void> {
    await handle.deleteFrom('app.portfolios').where('ownerUserid', '=', ownerUserid).execute();
  },

  async deletePortfolio(handle: DbHandle, ownerUserid: string, portfolioId: string): Promise<void> {
    await handle
      .deleteFrom('app.portfolios')
      .where('id', '=', portfolioId)
      .where('ownerUserid', '=', ownerUserid)
      .execute();
  },

  async updatePortfolioSlug(
    handle: DbHandle,
    ownerUserid: string,
    portfolioId: string,
    slug: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .updateTable('app.portfolios')
      .set({ slug })
      .where('id', '=', portfolioId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirstOrThrow();
  },

  async updatePortfolioProfileImage(
    handle: DbHandle,
    ownerUserid: string,
    profileImageUrl: string,
  ): Promise<void> {
    const portfolio = await CareerRepository.getPortfolioByUserId(handle, ownerUserid);
    if (!portfolio) {
      throw new NotFoundError('Portfolio', { ownerUserid });
    }

    await handle
      .updateTable('app.portfolios')
      .set({ profileImageUrl: profileImageUrl })
      .where('id', '=', portfolio.id)
      .executeTakeFirstOrThrow();
  },

  async findOrCreateCompany(
    handle: DbHandle,
    ownerUserid: string,
    input: {
      name: string;
      website?: string | null;
      industry?: string | null;
      size?: number | null;
      location?: string | null;
      description?: string | null;
    },
  ): Promise<CareerCompanyRecord> {
    const normalizedName = input.name.trim();

    const existing = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .where(sql<string>`lower(name)`, '=', normalizedName.toLowerCase())
      .executeTakeFirst();

    if (existing) {
      return existing as CompanyRow;
    }

    const created = await handle
      .insertInto('app.companies')
      .values({
        ownerUserid: ownerUserid,
        name: normalizedName,
        website: input.website ?? null,
        industry: input.industry ?? null,
        size: input.size ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as CompanyRow;
  },

  async createJobApplication(
    handle: DbHandle,
    ownerUserid: string,
    input: {
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
    },
  ): Promise<CareerJobApplicationRecord> {
    const company = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('id', '=', input.companyId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirst();

    if (!company) {
      throw new NotFoundError('Company', { companyId: input.companyId, ownerUserid });
    }

    const created = await handle
      .insertInto('app.jobApplications')
      .values({
        ownerUserid: ownerUserid,
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
    ownerUserid: string,
    applicationId: string,
    status: string,
  ): Promise<void> {
    await handle
      .updateTable('app.jobApplications')
      .set({ status })
      .where('id', '=', applicationId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirstOrThrow();
  },

  async deleteJobApplication(
    handle: DbHandle,
    ownerUserid: string,
    applicationId: string,
  ): Promise<void> {
    await handle
      .deleteFrom('app.jobApplications')
      .where('id', '=', applicationId)
      .where('ownerUserid', '=', ownerUserid)
      .executeTakeFirstOrThrow();
  },

  async listUserWorkExperiences(
    handle: DbHandle,
    ownerUserid: string,
    direction: 'asc' | 'desc' = 'desc',
  ): Promise<CareerWorkExperienceRecord[]> {
    let query = handle
      .selectFrom('app.workExperiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolioId')
      .selectAll('workExperience')
      .where('portfolio.ownerUserid', '=', ownerUserid);

    query =
      direction === 'desc'
        ? query
            .orderBy(sql`case when "workExperience"."endDate" is null then 0 else 1 end`)
            .orderBy('workExperience.endDate', 'desc')
            .orderBy('workExperience.startDate', 'desc')
        : query
            .orderBy(sql`case when "workExperience"."endDate" is null then 1 else 0 end`)
            .orderBy('workExperience.startDate', 'asc')
            .orderBy('workExperience.endDate', 'asc');

    const rows = await query.execute();

    return rows as WorkExperienceRow[];
  },

  async getWorkExperienceById(
    handle: DbHandle,
    ownerUserid: string,
    experienceId: string,
  ): Promise<CareerWorkExperienceRecord | null> {
    const row = await handle
      .selectFrom('app.workExperiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolioId')
      .selectAll('workExperience')
      .where('portfolio.ownerUserid', '=', ownerUserid)
      .where('workExperience.id', '=', experienceId)
      .executeTakeFirst();

    return (row as WorkExperienceRow | undefined) ?? null;
  },

  async updateWorkExperience(
    handle: DbHandle,
    ownerUserid: string,
    experienceId: string,
    updates: UpdateCareerWorkExperienceInput,
  ): Promise<CareerWorkExperienceRecord> {
    const existing = await CareerRepository.getWorkExperienceById(
      handle,
      ownerUserid,
      experienceId,
    );
    if (!existing) {
      throw new NotFoundError('WorkExperience', { experienceId, ownerUserid });
    }

    // Build only the columns that were explicitly provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set: Record<string, any> = {};
    if (updates.role !== undefined) set.role = updates.role;
    if (updates.company !== undefined) set.company = updates.company;
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.startDate !== undefined)
      set.startDate = updates.startDate ? new Date(updates.startDate) : null;
    if (updates.endDate !== undefined)
      set.endDate = updates.endDate ? new Date(updates.endDate) : null;
    if (updates.action !== undefined) set.action = updates.action;
    if (updates.tags !== undefined) set.tags = serializeJsonColumn(updates.tags);
    if (updates.metadata !== undefined)
      set.metadata = serializeJsonColumn(updates.metadata ?? null);
    if (updates.sortOrder !== undefined) set.sortOrder = updates.sortOrder;
    if (updates.isVisible !== undefined) set.isVisible = updates.isVisible;
    if (updates.baseSalary !== undefined) set.baseSalary = updates.baseSalary;
    if (updates.signingBonus !== undefined) set.signingBonus = updates.signingBonus;
    if (updates.annualBonus !== undefined) set.annualBonus = updates.annualBonus;
    if (updates.employmentType !== undefined) set.employmentType = updates.employmentType;
    if (updates.workArrangement !== undefined) set.workArrangement = updates.workArrangement;
    if (updates.seniorityLevel !== undefined) set.seniorityLevel = updates.seniorityLevel;
    if (updates.department !== undefined) set.department = updates.department;
    if (updates.teamSize !== undefined) set.teamSize = updates.teamSize;
    if (updates.directReports !== undefined) set.directReports = updates.directReports;
    if (updates.reportsTo !== undefined) set.reportsTo = updates.reportsTo;
    if (updates.reasonForLeaving !== undefined) set.reasonForLeaving = updates.reasonForLeaving;
    if (updates.exitNotes !== undefined) set.exitNotes = updates.exitNotes;

    const updated = await handle
      .updateTable('app.workExperiences')
      // biome-ignore lint/suspicious/noExplicitAny: dynamic column mapping
      .set(set as any)
      .where('id', '=', experienceId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated as WorkExperienceRow;
  },

  async listProjectsByPortfolio(
    handle: DbHandle,
    portfolioId: string,
  ): Promise<CareerProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .orderBy('createdat', 'desc')
      .execute();

    return rows as ProjectRow[];
  },

  async listProjectsByWorkExperience(
    handle: DbHandle,
    portfolioId: string,
    workExperienceId: string,
  ): Promise<CareerProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .where('workExperienceId', '=', workExperienceId)
      .orderBy('createdat', 'desc')
      .execute();

    return rows as ProjectRow[];
  },

  async getProjectById(
    handle: DbHandle,
    ownerUserid: string,
    projectId: string,
  ): Promise<CareerProjectRecord | null> {
    const row = await handle
      .selectFrom('app.projects as project')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'project.portfolioId')
      .selectAll('project')
      .where('portfolio.ownerUserid', '=', ownerUserid)
      .where('project.id', '=', projectId)
      .executeTakeFirst();

    return (row as ProjectRow | undefined) ?? null;
  },

  async listUserCareerEvents(
    handle: DbHandle,
    ownerUserid: string,
    limit?: number,
  ): Promise<CareerEventRecord[]> {
    let query = handle
      .selectFrom('app.careerEvents')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .orderBy('eventDate', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const rows = await query.execute();
    return rows as CareerEventRow[];
  },

  async getApplicationById(
    handle: DbHandle,
    ownerUserid: string,
    applicationId: string,
  ): Promise<CareerJobApplicationRecord | null> {
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
  ): Promise<CareerJobApplicationRecord[]> {
    const applications = await handle
      .selectFrom('app.jobApplications')
      .selectAll()
      .where('ownerUserid', '=', ownerUserid)
      .orderBy('applicationDate', 'desc')
      .execute();
    const companyIds = [...new Set(applications.map((application) => application.companyId))];

    const companies =
      companyIds.length === 0
        ? []
        : await handle
            .selectFrom('app.companies')
            .selectAll()
            .where('id', 'in', companyIds)
            .execute();
    const companiesById = new Map(companies.map((company) => [company.id, company as CompanyRow]));

    return (applications as JobApplicationRow[]).map((application) =>
      toJobApplicationRecord(application, companiesById.get(application.companyId) ?? null),
    );
  },

  async savePortfolioBasics(
    handle: DbHandle,
    ownerUserid: string,
    input: {
      name: string;
      initials?: string | null;
      jobTitle: string;
      title?: string | null;
      bio: string;
      tagline: string;
      currentLocation: string;
      locationTagline?: string | null;
      email: string;
      phone?: string | null;
      availabilityStatus?: boolean;
      availabilityMessage?: string | null;
      theme?: Record<string, unknown> | null;
      copyright?: string | null;
      isPublic?: boolean;
      isActive?: boolean;
    },
  ): Promise<CareerPortfolioRecord> {
    const existing = await CareerRepository.getPortfolioByUserId(handle, ownerUserid);

    if (existing) {
      const updated = await handle
        .updateTable('app.portfolios')
        .set({
          name: input.name,
          initials: input.initials ?? null,
          jobTitle: input.jobTitle,
          title: input.title ?? `${input.name}'s Portfolio`,
          bio: input.bio,
          tagline: input.tagline,
          currentLocation: input.currentLocation,
          locationTagline: input.locationTagline ?? null,
          email: input.email,
          phone: input.phone ?? null,
          availabilityStatus: input.availabilityStatus ?? false,
          availabilityMessage: input.availabilityMessage ?? null,
          ...(input.theme !== undefined ? { theme: serializeJsonColumn(input.theme ?? null) } : {}),
          ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
          ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return updated as PortfolioRow;
    }

    const created = await handle
      .insertInto('app.portfolios')
      .values({
        ownerUserid: ownerUserid,
        slug: createPortfolioSlug(input.name),
        name: input.name,
        initials: input.initials ?? null,
        jobTitle: input.jobTitle,
        title: input.title ?? `${input.name}'s Portfolio`,
        bio: input.bio,
        tagline: input.tagline,
        currentLocation: input.currentLocation,
        locationTagline: input.locationTagline ?? null,
        email: input.email,
        phone: input.phone ?? null,
        availabilityStatus: input.availabilityStatus ?? false,
        availabilityMessage: input.availabilityMessage ?? null,
        ...(input.theme !== undefined ? { theme: serializeJsonColumn(input.theme ?? null) } : {}),
        ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
        ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as PortfolioRow;
  },

  async saveSocialLinks(
    handle: DbHandle,
    ownerUserid: string,
    portfolioId: string,
    input: {
      id?: string;
      github?: string | null;
      linkedin?: string | null;
      twitter?: string | null;
      website?: string | null;
    },
  ): Promise<CareerSocialLinksRecord> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    const existing = await handle
      .selectFrom('app.socialLinks')
      .selectAll()
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirst();

    if (existing) {
      const updated = await handle
        .updateTable('app.socialLinks')
        .set({
          github: input.github ?? null,
          linkedin: input.linkedin ?? null,
          twitter: input.twitter ?? null,
          website: input.website ?? null,
        })
        .where('id', '=', (existing as SocialLinksRow).id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return updated as SocialLinksRow;
    }

    const created = await handle
      .insertInto('app.socialLinks')
      .values({
        portfolioId: portfolioId,
        github: input.github ?? null,
        linkedin: input.linkedin ?? null,
        twitter: input.twitter ?? null,
        website: input.website ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as SocialLinksRow;
  },

  async replaceSkills(
    handle: DbHandle,
    ownerUserid: string,
    portfolioId: string,
    skills: Array<{
      id?: string;
      name: string;
      category?: string | null;
      level: number;
      aiDerived?: boolean;
      proof?: string | null;
    }>,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    const current = await handle
      .selectFrom('app.skills')
      .select(['id'])
      .where('portfolioId', '=', portfolioId)
      .execute();

    const currentIds = current.map((item) => item.id);
    const submittedIds = skills.flatMap((item) => (item.id ? [item.id] : []));
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id));

    if (toDelete.length > 0) {
      await handle
        .deleteFrom('app.skills')
        .where('portfolioId', '=', portfolioId)
        .where('id', 'in', toDelete)
        .execute();
    }

    for (const [index, skill] of skills.entries()) {
      if (skill.id) {
        await handle
          .updateTable('app.skills')
          .set({
            name: skill.name,
            category: skill.category ?? null,
            level: skill.level,
            sortOrder: index,
            ...(skill.proof !== undefined && { proof: skill.proof }),
          })
          .where('id', '=', skill.id)
          .where('portfolioId', '=', portfolioId)
          .execute();
      } else {
        await handle
          .insertInto('app.skills')
          .values({
            portfolioId: portfolioId,
            name: skill.name,
            category: skill.category ?? null,
            level: skill.level,
            sortOrder: index,
            aiDerived: skill.aiDerived ?? false,
            proof: skill.proof ?? null,
          })
          .execute();
      }
    }
  },

  async createProject(
    handle: DbHandle,
    ownerUserid: string,
    input: {
      portfolioId: string;
      workExperienceId?: string | null;
      title: string;
      description: string;
      shortDescription?: string | null;
      liveUrl?: string | null;
      githubUrl?: string | null;
      imageUrl?: string | null;
      videoUrl?: string | null;
      technologies?: string[];
      status?: string;
      startDate?: Date | string | null;
      endDate?: Date | string | null;
      isFeatured?: boolean;
      isVisible?: boolean;
      sortOrder?: number;
    },
  ): Promise<CareerProjectRecord> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, input.portfolioId);

    const created = await handle
      .insertInto('app.projects')
      .values({
        portfolioId: input.portfolioId,
        workExperienceId: input.workExperienceId ?? null,
        title: input.title,
        description: input.description,
        shortDescription: input.shortDescription ?? null,
        liveUrl: input.liveUrl ?? null,
        githubUrl: input.githubUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        technologies: serializeJsonColumn(input.technologies ?? []),
        status: input.status ?? 'completed',
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isFeatured: input.isFeatured ?? false,
        isVisible: input.isVisible ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as ProjectRow;
  },

  async updateProject(
    handle: DbHandle,
    ownerUserid: string,
    projectId: string,
    portfolioId: string,
    input: {
      workExperienceId?: string | null;
      title: string;
      description: string;
      shortDescription?: string | null;
      liveUrl?: string | null;
      githubUrl?: string | null;
      imageUrl?: string | null;
      videoUrl?: string | null;
      technologies?: string[];
      status?: string;
      startDate?: Date | string | null;
      endDate?: Date | string | null;
      isFeatured?: boolean;
      isVisible?: boolean;
      sortOrder?: number;
    },
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .updateTable('app.projects')
      .set({
        title: input.title,
        description: input.description,
        shortDescription: input.shortDescription ?? null,
        liveUrl: input.liveUrl ?? null,
        githubUrl: input.githubUrl ?? null,
        imageUrl: input.imageUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        technologies: serializeJsonColumn(input.technologies ?? []),
        status: input.status ?? 'completed',
        workExperienceId: input.workExperienceId ?? null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isFeatured: input.isFeatured ?? false,
        isVisible: input.isVisible ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .where('id', '=', projectId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async deleteProject(
    handle: DbHandle,
    ownerUserid: string,
    projectId: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .deleteFrom('app.projects')
      .where('id', '=', projectId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async createTestimonial(
    handle: DbHandle,
    ownerUserid: string,
    input: {
      portfolioId: string;
      name: string;
      title?: string | null;
      company?: string | null;
      content: string;
      avatarUrl?: string | null;
      linkedinUrl?: string | null;
      rating?: number | null;
    },
  ): Promise<CareerTestimonialRecord> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, input.portfolioId);

    const created = await handle
      .insertInto('app.testimonials')
      .values({
        portfolioId: input.portfolioId,
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatarUrl: input.avatarUrl ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        rating: input.rating ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as TestimonialRow;
  },

  async updateTestimonial(
    handle: DbHandle,
    ownerUserid: string,
    testimonialId: string,
    portfolioId: string,
    input: {
      name: string;
      title?: string | null;
      company?: string | null;
      content: string;
      avatarUrl?: string | null;
      linkedinUrl?: string | null;
      rating?: number | null;
    },
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .updateTable('app.testimonials')
      .set({
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatarUrl: input.avatarUrl ?? null,
        linkedinUrl: input.linkedinUrl ?? null,
        rating: input.rating ?? null,
      })
      .where('id', '=', testimonialId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async deleteTestimonial(
    handle: DbHandle,
    ownerUserid: string,
    testimonialId: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .deleteFrom('app.testimonials')
      .where('id', '=', testimonialId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async createWorkExperience(
    handle: DbHandle,
    ownerUserid: string,
    input: {
      portfolioId: string;
      role: string;
      company: string;
      description: string;
      startDate?: Date | string | null;
      endDate?: Date | string | null;
      action?: string | null;
      tags?: string[];
      metadata?: Record<string, unknown> | null;
      sortOrder?: number;
      isVisible?: boolean;
    },
  ): Promise<CareerWorkExperienceRecord> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, input.portfolioId);

    const created = await handle
      .insertInto('app.workExperiences')
      .values({
        portfolioId: input.portfolioId,
        role: input.role,
        company: input.company,
        description: input.description,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        action: input.action ?? null,
        ...(input.tags !== undefined ? { tags: serializeJsonColumn(input.tags) } : {}),
        ...(input.metadata !== undefined
          ? { metadata: serializeJsonColumn(input.metadata ?? null) }
          : {}),
        sortOrder: input.sortOrder ?? 0,
        isVisible: input.isVisible ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as WorkExperienceRow;
  },

  async deleteWorkExperience(
    handle: DbHandle,
    ownerUserid: string,
    experienceId: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, ownerUserid, portfolioId);

    await handle
      .deleteFrom('app.workExperiences')
      .where('id', '=', experienceId)
      .where('portfolioId', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },
};
