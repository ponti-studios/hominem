import { sql } from 'kysely';
import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type {
  AppCareerEvents,
  AppCertifications,
  AppCompanies,
  AppJobApplications,
  AppPortfolioStats,
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
type PortfolioStatRow = Selectable<AppPortfolioStats>;
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
  previous_salary: number;
  new_salary: number;
  increaseAmount: number;
  increase_percentage: number;
  reason: 'promotion' | 'merit_increase' | 'market_adjustment' | 'cost_of_living' | 'role_change';
  new_title?: string;
  notes?: string;
  company: string;
  work_experience_id: string;
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
export type CareerPortfolioStatRecord = PortfolioStatRow;
export type CareerWorkExperienceRecord = WorkExperienceRow;
export type CareerSkillRecord = SkillRow;
export type CareerProjectRecord = ProjectRow;
export type CareerTestimonialRecord = TestimonialRow;

export interface CareerFullPortfolioRecord extends CareerPortfolioRecord {
  social_links: CareerSocialLinksRecord | null;
  portfolio_stats: CareerPortfolioStatRecord[];
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
  owner_userid: string;
  email: string;
  name: string;
}

export interface UpdateCareerWorkExperienceInput {
  role?: string;
  company?: string;
  description?: string;
  start_date?: Date | string | null;
  end_date?: Date | string | null;
  action?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  sort_order?: number;
  is_visible?: boolean;
  // financial
  base_salary?: number | null;
  total_compensation?: number | null;
  equity_value?: number | null;
  equity_percentage?: string | null;
  signing_bonus?: number | null;
  annual_bonus?: number | null;
  // role details
  employment_type?: string | null;
  work_arrangement?: string | null;
  seniority_level?: string | null;
  department?: string | null;
  team_size?: number | null;
  direct_reports?: number | null;
  reports_to?: string | null;
  // exit
  reason_for_leaving?: string | null;
  exit_notes?: string | null;
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
  const [social_links, portfolio_stats, work_experiences, skills, projects, testimonials] =
    await Promise.all([
      handle
        .selectFrom('app.social_links')
        .selectAll()
        .where('portfolio_id', '=', portfolio.id)
        .executeTakeFirst(),
      handle
        .selectFrom('app.portfolio_stats')
        .selectAll()
        .where('portfolio_id', '=', portfolio.id)
        .orderBy('sort_order', 'asc')
        .execute(),
      handle
        .selectFrom('app.work_experiences')
        .selectAll()
        .where('portfolio_id', '=', portfolio.id)
        .orderBy(sql`start_date asc nulls last`)
        .execute(),
      handle
        .selectFrom('app.skills')
        .selectAll()
        .where('portfolio_id', '=', portfolio.id)
        .orderBy('sort_order', 'asc')
        .execute(),
      handle
        .selectFrom('app.projects')
        .selectAll()
        .where('portfolio_id', '=', portfolio.id)
        .orderBy('sort_order', 'asc')
        .execute(),
      handle
        .selectFrom('app.testimonials')
        .selectAll()
        .where('portfolio_id', '=', portfolio.id)
        .orderBy('sort_order', 'asc')
        .execute(),
    ]);

  return {
    ...portfolio,
    social_links: (social_links as SocialLinksRow | undefined) ?? null,
    portfolio_stats: portfolio_stats as PortfolioStatRow[],
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

async function getOwnedPortfolioRow(handle: DbHandle, owner_userid: string, portfolio_id: string) {
  return handle
    .selectFrom('app.portfolios')
    .selectAll()
    .where('id', '=', portfolio_id)
    .where('owner_userid', '=', owner_userid)
    .executeTakeFirst();
}

async function getOwnedPortfolioRowOrThrow(
  handle: DbHandle,
  owner_userid: string,
  portfolio_id: string,
) {
  const portfolio = await getOwnedPortfolioRow(handle, owner_userid, portfolio_id);
  if (!portfolio) {
    throw new NotFoundError('Portfolio', { portfolio_id, owner_userid });
  }
  return portfolio as PortfolioRow;
}

async function getCurrentPortfolioPreference(
  handle: DbHandle,
  owner_userid: string,
): Promise<UserPortfolioPreferenceRow | null> {
  const preference = await handle
    .selectFrom('app.user_portfolio_preferences')
    .selectAll()
    .where('user_id', '=', owner_userid)
    .executeTakeFirst();

  return (preference as UserPortfolioPreferenceRow | undefined) ?? null;
}

async function resolveCurrentPortfolioRow(
  handle: DbHandle,
  owner_userid: string,
): Promise<PortfolioRow | null> {
  const preference = await getCurrentPortfolioPreference(handle, owner_userid);

  if (preference?.current_portfolio_id) {
    const preferredPortfolio = await getOwnedPortfolioRow(
      handle,
      owner_userid,
      preference.current_portfolio_id,
    );
    if (preferredPortfolio) {
      return preferredPortfolio as PortfolioRow;
    }
  }

  const fallbackPortfolio = await handle
    .selectFrom('app.portfolios')
    .selectAll()
    .where('owner_userid', '=', owner_userid)
    .orderBy('createdat', 'desc')
    .executeTakeFirst();

  return (fallbackPortfolio as PortfolioRow | undefined) ?? null;
}

export const CareerRepository = {
  async getPortfolioByUserId(
    handle: DbHandle,
    owner_userid: string,
  ): Promise<CareerPortfolioRecord | null> {
    const portfolio = await resolveCurrentPortfolioRow(handle, owner_userid);

    return portfolio;
  },

  async listPortfoliosByUserId(
    handle: DbHandle,
    owner_userid: string,
  ): Promise<CareerPortfolioRecord[]> {
    const portfolios = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where('owner_userid', '=', owner_userid)
      .orderBy('createdat', 'desc')
      .execute();

    return portfolios as PortfolioRow[];
  },

  async getCurrentPortfolioIdByUserId(
    handle: DbHandle,
    owner_userid: string,
  ): Promise<string | null> {
    const preference = await getCurrentPortfolioPreference(handle, owner_userid);
    return preference?.current_portfolio_id ?? null;
  },

  async setCurrentPortfolioByUserId(
    handle: DbHandle,
    owner_userid: string,
    portfolio_id: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .insertInto('app.user_portfolio_preferences')
      .values({
        user_id: owner_userid,
        current_portfolio_id: portfolio_id,
      })
      .onConflict((oc) =>
        oc.column('user_id').doUpdateSet({
          current_portfolio_id: portfolio_id,
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
    owner_userid: string,
  ): Promise<CareerFullPortfolioRecord | null> {
    const portfolio = await CareerRepository.getPortfolioByUserId(handle, owner_userid);
    return portfolio ? loadFullPortfolio(handle, portfolio) : null;
  },

  async loadFullPortfolioBySlug(
    handle: DbHandle,
    slug: string,
  ): Promise<CareerFullPortfolioRecord | null> {
    const portfolio = await CareerRepository.getPortfolioBySlug(handle, slug);
    if (!portfolio || !portfolio.is_public || !portfolio.is_active) {
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
        owner_userid: input.owner_userid,
        slug: createPortfolioSlug(input.name),
        title: `${input.name}'s Portfolio`,
        name: input.name,
        job_title: 'Software Engineer',
        bio: 'Welcome to my portfolio!',
        tagline: 'Building the future of software',
        current_location: 'San Francisco, CA',
        email: input.email,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as PortfolioRow;
  },

  async deletePortfolioByUserId(handle: DbHandle, owner_userid: string): Promise<void> {
    await handle.deleteFrom('app.portfolios').where('owner_userid', '=', owner_userid).execute();
  },

  async deletePortfolio(
    handle: DbHandle,
    owner_userid: string,
    portfolio_id: string,
  ): Promise<void> {
    await handle
      .deleteFrom('app.portfolios')
      .where('id', '=', portfolio_id)
      .where('owner_userid', '=', owner_userid)
      .execute();
  },

  async updatePortfolioSlug(
    handle: DbHandle,
    owner_userid: string,
    portfolio_id: string,
    slug: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .updateTable('app.portfolios')
      .set({ slug })
      .where('id', '=', portfolio_id)
      .where('owner_userid', '=', owner_userid)
      .executeTakeFirstOrThrow();
  },

  async updatePortfolioProfileImage(
    handle: DbHandle,
    owner_userid: string,
    profile_image_url: string,
  ): Promise<void> {
    const portfolio = await CareerRepository.getPortfolioByUserId(handle, owner_userid);
    if (!portfolio) {
      throw new NotFoundError('Portfolio', { owner_userid });
    }

    await handle
      .updateTable('app.portfolios')
      .set({ profile_image_url: profile_image_url })
      .where('id', '=', portfolio.id)
      .executeTakeFirstOrThrow();
  },

  async findOrCreateCompany(
    handle: DbHandle,
    owner_userid: string,
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
      .where('owner_userid', '=', owner_userid)
      .where(sql<string>`lower(name)`, '=', normalizedName.toLowerCase())
      .executeTakeFirst();

    if (existing) {
      return existing as CompanyRow;
    }

    const created = await handle
      .insertInto('app.companies')
      .values({
        owner_userid: owner_userid,
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
    owner_userid: string,
    input: {
      company_id: string;
      position: string;
      status: string;
      start_date: Date | string;
      end_date?: Date | string | null;
      location?: string | null;
      job_posting?: string | null;
      requirements?: string[];
      skills?: string[];
      job_posting_url?: string | null;
      job_posting_word_count?: number | null;
      salary_quoted?: string | null;
      salary_accepted?: string | null;
      salary_offered?: number | null;
      salary_final?: number | null;
      source?: string | null;
      application_date?: Date | string | null;
      link?: string | null;
      recruiter_name?: string | null;
      recruiter_email?: string | null;
      recruiter_linkedin?: string | null;
      reference?: boolean;
      stages?: CareerApplicationStage[];
      interview_dates?: CareerInterviewEntry[];
    },
  ): Promise<CareerJobApplicationRecord> {
    const company = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('id', '=', input.company_id)
      .where('owner_userid', '=', owner_userid)
      .executeTakeFirst();

    if (!company) {
      throw new NotFoundError('Company', { company_id: input.company_id, owner_userid });
    }

    const created = await handle
      .insertInto('app.job_applications')
      .values({
        owner_userid: owner_userid,
        company_id: input.company_id,
        position: input.position,
        status: input.status,
        start_date: new Date(input.start_date),
        end_date: input.end_date ? new Date(input.end_date) : null,
        location: input.location ?? null,
        job_posting: input.job_posting ?? null,
        requirements: serializeJsonColumn(input.requirements ?? []),
        skills: serializeJsonColumn(input.skills ?? []),
        job_posting_url: input.job_posting_url ?? null,
        job_posting_word_count: input.job_posting_word_count ?? null,
        salary_quoted: input.salary_quoted ?? null,
        salary_accepted: input.salary_accepted ?? null,
        salary_offered: input.salary_offered ?? null,
        salary_final: input.salary_final ?? null,
        source: input.source ?? null,
        application_date: input.application_date ? new Date(input.application_date) : null,
        link: input.link ?? null,
        recruiter_name: input.recruiter_name ?? null,
        recruiter_email: input.recruiter_email ?? null,
        recruiter_linkedin: input.recruiter_linkedin ?? null,
        reference: input.reference ?? false,
        stages: serializeJsonColumn(input.stages ?? []),
        interview_dates: serializeJsonColumn(input.interview_dates ?? []),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toJobApplicationRecord(created as JobApplicationRow, company as CompanyRow);
  },

  async updateJobApplicationStatus(
    handle: DbHandle,
    owner_userid: string,
    applicationId: string,
    status: string,
  ): Promise<void> {
    await handle
      .updateTable('app.job_applications')
      .set({ status })
      .where('id', '=', applicationId)
      .where('owner_userid', '=', owner_userid)
      .executeTakeFirstOrThrow();
  },

  async deleteJobApplication(
    handle: DbHandle,
    owner_userid: string,
    applicationId: string,
  ): Promise<void> {
    await handle
      .deleteFrom('app.job_applications')
      .where('id', '=', applicationId)
      .where('owner_userid', '=', owner_userid)
      .executeTakeFirstOrThrow();
  },

  async listUserWorkExperiences(
    handle: DbHandle,
    owner_userid: string,
    direction: 'asc' | 'desc' = 'desc',
  ): Promise<CareerWorkExperienceRecord[]> {
    let query = handle
      .selectFrom('app.work_experiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolio_id')
      .selectAll('workExperience')
      .where('portfolio.owner_userid', '=', owner_userid);

    query =
      direction === 'desc'
        ? query
            .orderBy(sql`case when "workExperience"."end_date" is null then 0 else 1 end`)
            .orderBy('workExperience.end_date', 'desc')
            .orderBy('workExperience.start_date', 'desc')
        : query
            .orderBy(sql`case when "workExperience"."end_date" is null then 1 else 0 end`)
            .orderBy('workExperience.start_date', 'asc')
            .orderBy('workExperience.end_date', 'asc');

    const rows = await query.execute();

    return rows as WorkExperienceRow[];
  },

  async getWorkExperienceById(
    handle: DbHandle,
    owner_userid: string,
    experienceId: string,
  ): Promise<CareerWorkExperienceRecord | null> {
    const row = await handle
      .selectFrom('app.work_experiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolio_id')
      .selectAll('workExperience')
      .where('portfolio.owner_userid', '=', owner_userid)
      .where('workExperience.id', '=', experienceId)
      .executeTakeFirst();

    return (row as WorkExperienceRow | undefined) ?? null;
  },

  async updateWorkExperience(
    handle: DbHandle,
    owner_userid: string,
    experienceId: string,
    updates: UpdateCareerWorkExperienceInput,
  ): Promise<CareerWorkExperienceRecord> {
    const existing = await CareerRepository.getWorkExperienceById(
      handle,
      owner_userid,
      experienceId,
    );
    if (!existing) {
      throw new NotFoundError('WorkExperience', { experienceId, owner_userid });
    }

    // Build only the columns that were explicitly provided
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const set: Record<string, any> = {};
    if (updates.role !== undefined) set.role = updates.role;
    if (updates.company !== undefined) set.company = updates.company;
    if (updates.description !== undefined) set.description = updates.description;
    if (updates.start_date !== undefined)
      set.start_date = updates.start_date ? new Date(updates.start_date) : null;
    if (updates.end_date !== undefined)
      set.end_date = updates.end_date ? new Date(updates.end_date) : null;
    if (updates.action !== undefined) set.action = updates.action;
    if (updates.tags !== undefined) set.tags = serializeJsonColumn(updates.tags);
    if (updates.metadata !== undefined)
      set.metadata = serializeJsonColumn(updates.metadata ?? null);
    if (updates.sort_order !== undefined) set.sort_order = updates.sort_order;
    if (updates.is_visible !== undefined) set.is_visible = updates.is_visible;
    if (updates.base_salary !== undefined) set.base_salary = updates.base_salary;
    if (updates.total_compensation !== undefined)
      set.total_compensation = updates.total_compensation;
    if (updates.equity_value !== undefined) set.equity_value = updates.equity_value;
    if (updates.equity_percentage !== undefined) set.equity_percentage = updates.equity_percentage;
    if (updates.signing_bonus !== undefined) set.signing_bonus = updates.signing_bonus;
    if (updates.annual_bonus !== undefined) set.annual_bonus = updates.annual_bonus;
    if (updates.employment_type !== undefined) set.employment_type = updates.employment_type;
    if (updates.work_arrangement !== undefined) set.work_arrangement = updates.work_arrangement;
    if (updates.seniority_level !== undefined) set.seniority_level = updates.seniority_level;
    if (updates.department !== undefined) set.department = updates.department;
    if (updates.team_size !== undefined) set.team_size = updates.team_size;
    if (updates.direct_reports !== undefined) set.direct_reports = updates.direct_reports;
    if (updates.reports_to !== undefined) set.reports_to = updates.reports_to;
    if (updates.reason_for_leaving !== undefined)
      set.reason_for_leaving = updates.reason_for_leaving;
    if (updates.exit_notes !== undefined) set.exit_notes = updates.exit_notes;

    const updated = await handle
      .updateTable('app.work_experiences')
      // biome-ignore lint/suspicious/noExplicitAny: dynamic column mapping
      .set(set as any)
      .where('id', '=', experienceId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated as WorkExperienceRow;
  },

  async listProjectsByPortfolio(
    handle: DbHandle,
    portfolio_id: string,
  ): Promise<CareerProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolio_id', '=', portfolio_id)
      .orderBy('createdat', 'desc')
      .execute();

    return rows as ProjectRow[];
  },

  async listProjectsByWorkExperience(
    handle: DbHandle,
    portfolio_id: string,
    work_experience_id: string,
  ): Promise<CareerProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolio_id', '=', portfolio_id)
      .where('work_experience_id', '=', work_experience_id)
      .orderBy('createdat', 'desc')
      .execute();

    return rows as ProjectRow[];
  },

  async listUserCareerEvents(
    handle: DbHandle,
    owner_userid: string,
    limit?: number,
  ): Promise<CareerEventRecord[]> {
    let query = handle
      .selectFrom('app.career_events')
      .selectAll()
      .where('owner_userid', '=', owner_userid)
      .orderBy('event_date', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const rows = await query.execute();
    return rows as CareerEventRow[];
  },

  async getApplicationById(
    handle: DbHandle,
    owner_userid: string,
    applicationId: string,
  ): Promise<CareerJobApplicationRecord | null> {
    const application = await handle
      .selectFrom('app.job_applications')
      .selectAll()
      .where('owner_userid', '=', owner_userid)
      .where('id', '=', applicationId)
      .executeTakeFirst();

    if (!application) return null;

    const company = await handle
      .selectFrom('app.companies')
      .selectAll()
      .where('id', '=', application.company_id)
      .executeTakeFirst();

    return toJobApplicationRecord(
      application as JobApplicationRow,
      (company as CompanyRow | undefined) ?? null,
    );
  },

  async listUserJobApplicationsWithCompany(
    handle: DbHandle,
    owner_userid: string,
  ): Promise<CareerJobApplicationRecord[]> {
    const applications = await handle
      .selectFrom('app.job_applications')
      .selectAll()
      .where('owner_userid', '=', owner_userid)
      .orderBy('application_date', 'desc')
      .execute();
    const companyIds = [...new Set(applications.map((application) => application.company_id))];

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
      toJobApplicationRecord(application, companiesById.get(application.company_id) ?? null),
    );
  },

  async savePortfolioBasics(
    handle: DbHandle,
    owner_userid: string,
    input: {
      name: string;
      initials?: string | null;
      job_title: string;
      title?: string | null;
      bio: string;
      tagline: string;
      current_location: string;
      location_tagline?: string | null;
      email: string;
      phone?: string | null;
      availability_status?: boolean;
      availability_message?: string | null;
      theme?: Record<string, unknown> | null;
      copyright?: string | null;
      is_public?: boolean;
      is_active?: boolean;
    },
  ): Promise<CareerPortfolioRecord> {
    const existing = await CareerRepository.getPortfolioByUserId(handle, owner_userid);

    if (existing) {
      const updated = await handle
        .updateTable('app.portfolios')
        .set({
          name: input.name,
          initials: input.initials ?? null,
          job_title: input.job_title,
          title: input.title ?? `${input.name}'s Portfolio`,
          bio: input.bio,
          tagline: input.tagline,
          current_location: input.current_location,
          location_tagline: input.location_tagline ?? null,
          email: input.email,
          phone: input.phone ?? null,
          availability_status: input.availability_status ?? false,
          availability_message: input.availability_message ?? null,
          ...(input.theme !== undefined ? { theme: serializeJsonColumn(input.theme ?? null) } : {}),
          ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
          ...(input.is_public !== undefined ? { is_public: input.is_public } : {}),
          ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return updated as PortfolioRow;
    }

    const created = await handle
      .insertInto('app.portfolios')
      .values({
        owner_userid: owner_userid,
        slug: createPortfolioSlug(input.name),
        name: input.name,
        initials: input.initials ?? null,
        job_title: input.job_title,
        title: input.title ?? `${input.name}'s Portfolio`,
        bio: input.bio,
        tagline: input.tagline,
        current_location: input.current_location,
        location_tagline: input.location_tagline ?? null,
        email: input.email,
        phone: input.phone ?? null,
        availability_status: input.availability_status ?? false,
        availability_message: input.availability_message ?? null,
        ...(input.theme !== undefined ? { theme: serializeJsonColumn(input.theme ?? null) } : {}),
        ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
        ...(input.is_public !== undefined ? { is_public: input.is_public } : {}),
        ...(input.is_active !== undefined ? { is_active: input.is_active } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as PortfolioRow;
  },

  async saveSocialLinks(
    handle: DbHandle,
    owner_userid: string,
    portfolio_id: string,
    input: {
      id?: string;
      github?: string | null;
      linkedin?: string | null;
      twitter?: string | null;
      website?: string | null;
    },
  ): Promise<CareerSocialLinksRecord> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    const existing = await handle
      .selectFrom('app.social_links')
      .selectAll()
      .where('portfolio_id', '=', portfolio_id)
      .executeTakeFirst();

    if (existing) {
      const updated = await handle
        .updateTable('app.social_links')
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
      .insertInto('app.social_links')
      .values({
        portfolio_id: portfolio_id,
        github: input.github ?? null,
        linkedin: input.linkedin ?? null,
        twitter: input.twitter ?? null,
        website: input.website ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as SocialLinksRow;
  },

  async replacePortfolioStats(
    handle: DbHandle,
    owner_userid: string,
    portfolio_id: string,
    stats: Array<{ id?: string; label: string; value: string; sort_order?: number }>,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    const current = await handle
      .selectFrom('app.portfolio_stats')
      .select(['id'])
      .where('portfolio_id', '=', portfolio_id)
      .execute();

    const currentIds = current.map((item) => item.id);
    const submittedIds = stats.flatMap((item) => (item.id ? [item.id] : []));
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id));

    if (toDelete.length > 0) {
      await handle
        .deleteFrom('app.portfolio_stats')
        .where('portfolio_id', '=', portfolio_id)
        .where('id', 'in', toDelete)
        .execute();
    }

    for (const [index, stat] of stats.entries()) {
      if (stat.id) {
        await handle
          .updateTable('app.portfolio_stats')
          .set({
            label: stat.label,
            value: stat.value,
            sort_order: stat.sort_order ?? index,
          })
          .where('id', '=', stat.id)
          .where('portfolio_id', '=', portfolio_id)
          .execute();
      } else {
        await handle
          .insertInto('app.portfolio_stats')
          .values({
            portfolio_id: portfolio_id,
            label: stat.label,
            value: stat.value,
            sort_order: stat.sort_order ?? index,
          })
          .execute();
      }
    }
  },

  async replaceSkills(
    handle: DbHandle,
    owner_userid: string,
    portfolio_id: string,
    skills: Array<{ id?: string; name: string; category?: string | null; level: number }>,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    const current = await handle
      .selectFrom('app.skills')
      .select(['id'])
      .where('portfolio_id', '=', portfolio_id)
      .execute();

    const currentIds = current.map((item) => item.id);
    const submittedIds = skills.flatMap((item) => (item.id ? [item.id] : []));
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id));

    if (toDelete.length > 0) {
      await handle
        .deleteFrom('app.skills')
        .where('portfolio_id', '=', portfolio_id)
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
            sort_order: index,
          })
          .where('id', '=', skill.id)
          .where('portfolio_id', '=', portfolio_id)
          .execute();
      } else {
        await handle
          .insertInto('app.skills')
          .values({
            portfolio_id: portfolio_id,
            name: skill.name,
            category: skill.category ?? null,
            level: skill.level,
            sort_order: index,
          })
          .execute();
      }
    }
  },

  async createProject(
    handle: DbHandle,
    owner_userid: string,
    input: {
      portfolio_id: string;
      work_experience_id?: string | null;
      title: string;
      description: string;
      short_description?: string | null;
      live_url?: string | null;
      github_url?: string | null;
      image_url?: string | null;
      video_url?: string | null;
      technologies?: string[];
      status?: string;
      start_date?: Date | string | null;
      end_date?: Date | string | null;
      is_featured?: boolean;
      is_visible?: boolean;
      sort_order?: number;
    },
  ): Promise<CareerProjectRecord> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, input.portfolio_id);

    const created = await handle
      .insertInto('app.projects')
      .values({
        portfolio_id: input.portfolio_id,
        work_experience_id: input.work_experience_id ?? null,
        title: input.title,
        description: input.description,
        short_description: input.short_description ?? null,
        live_url: input.live_url ?? null,
        github_url: input.github_url ?? null,
        image_url: input.image_url ?? null,
        video_url: input.video_url ?? null,
        technologies: serializeJsonColumn(input.technologies ?? []),
        status: input.status ?? 'completed',
        start_date: input.start_date ? new Date(input.start_date) : null,
        end_date: input.end_date ? new Date(input.end_date) : null,
        is_featured: input.is_featured ?? false,
        is_visible: input.is_visible ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as ProjectRow;
  },

  async updateProject(
    handle: DbHandle,
    owner_userid: string,
    projectId: string,
    portfolio_id: string,
    input: {
      work_experience_id?: string | null;
      title: string;
      description: string;
      short_description?: string | null;
      live_url?: string | null;
      github_url?: string | null;
      image_url?: string | null;
      video_url?: string | null;
      technologies?: string[];
      status?: string;
      start_date?: Date | string | null;
      end_date?: Date | string | null;
      is_featured?: boolean;
      is_visible?: boolean;
      sort_order?: number;
    },
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .updateTable('app.projects')
      .set({
        title: input.title,
        description: input.description,
        short_description: input.short_description ?? null,
        live_url: input.live_url ?? null,
        github_url: input.github_url ?? null,
        image_url: input.image_url ?? null,
        video_url: input.video_url ?? null,
        technologies: serializeJsonColumn(input.technologies ?? []),
        status: input.status ?? 'completed',
        work_experience_id: input.work_experience_id ?? null,
        start_date: input.start_date ? new Date(input.start_date) : null,
        end_date: input.end_date ? new Date(input.end_date) : null,
        is_featured: input.is_featured ?? false,
        is_visible: input.is_visible ?? true,
        sort_order: input.sort_order ?? 0,
      })
      .where('id', '=', projectId)
      .where('portfolio_id', '=', portfolio_id)
      .executeTakeFirstOrThrow();
  },

  async deleteProject(
    handle: DbHandle,
    owner_userid: string,
    projectId: string,
    portfolio_id: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .deleteFrom('app.projects')
      .where('id', '=', projectId)
      .where('portfolio_id', '=', portfolio_id)
      .executeTakeFirstOrThrow();
  },

  async createTestimonial(
    handle: DbHandle,
    owner_userid: string,
    input: {
      portfolio_id: string;
      name: string;
      title?: string | null;
      company?: string | null;
      content: string;
      avatar_url?: string | null;
      linkedin_url?: string | null;
      rating?: number | null;
    },
  ): Promise<CareerTestimonialRecord> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, input.portfolio_id);

    const created = await handle
      .insertInto('app.testimonials')
      .values({
        portfolio_id: input.portfolio_id,
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatar_url: input.avatar_url ?? null,
        linkedin_url: input.linkedin_url ?? null,
        rating: input.rating ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as TestimonialRow;
  },

  async updateTestimonial(
    handle: DbHandle,
    owner_userid: string,
    testimonialId: string,
    portfolio_id: string,
    input: {
      name: string;
      title?: string | null;
      company?: string | null;
      content: string;
      avatar_url?: string | null;
      linkedin_url?: string | null;
      rating?: number | null;
    },
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .updateTable('app.testimonials')
      .set({
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatar_url: input.avatar_url ?? null,
        linkedin_url: input.linkedin_url ?? null,
        rating: input.rating ?? null,
      })
      .where('id', '=', testimonialId)
      .where('portfolio_id', '=', portfolio_id)
      .executeTakeFirstOrThrow();
  },

  async deleteTestimonial(
    handle: DbHandle,
    owner_userid: string,
    testimonialId: string,
    portfolio_id: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .deleteFrom('app.testimonials')
      .where('id', '=', testimonialId)
      .where('portfolio_id', '=', portfolio_id)
      .executeTakeFirstOrThrow();
  },

  async createWorkExperience(
    handle: DbHandle,
    owner_userid: string,
    input: {
      portfolio_id: string;
      role: string;
      company: string;
      description: string;
      start_date?: Date | string | null;
      end_date?: Date | string | null;
      action?: string | null;
      tags?: string[];
      metadata?: Record<string, unknown> | null;
      sort_order?: number;
      is_visible?: boolean;
    },
  ): Promise<CareerWorkExperienceRecord> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, input.portfolio_id);

    const created = await handle
      .insertInto('app.work_experiences')
      .values({
        portfolio_id: input.portfolio_id,
        role: input.role,
        company: input.company,
        description: input.description,
        start_date: input.start_date ? new Date(input.start_date) : null,
        end_date: input.end_date ? new Date(input.end_date) : null,
        action: input.action ?? null,
        ...(input.tags !== undefined ? { tags: serializeJsonColumn(input.tags) } : {}),
        ...(input.metadata !== undefined
          ? { metadata: serializeJsonColumn(input.metadata ?? null) }
          : {}),
        sort_order: input.sort_order ?? 0,
        is_visible: input.is_visible ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return created as WorkExperienceRow;
  },

  async deleteWorkExperience(
    handle: DbHandle,
    owner_userid: string,
    experienceId: string,
    portfolio_id: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, owner_userid, portfolio_id);

    await handle
      .deleteFrom('app.work_experiences')
      .where('id', '=', experienceId)
      .where('portfolio_id', '=', portfolio_id)
      .executeTakeFirstOrThrow();
  },
};
