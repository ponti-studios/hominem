import { sql } from 'kysely';
import type { Selectable } from 'kysely';

import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';
import type {
  AppCareerEvents,
  AppCompanies,
  AppJobApplications,
  AppPortfolioStats,
  AppPortfolios,
  AppProjects,
  AppSkills,
  AppSocialLinks,
  AppTestimonials,
  AppWorkExperiences,
  JsonValue,
} from '../../types/database';

type PortfolioRow = Selectable<AppPortfolios>;
type SocialLinksRow = Selectable<AppSocialLinks>;
type PortfolioStatRow = Selectable<AppPortfolioStats>;
type WorkExperienceRow = Selectable<AppWorkExperiences>;
type SkillRow = Selectable<AppSkills>;
type ProjectRow = Selectable<AppProjects>;
type TestimonialRow = Selectable<AppTestimonials>;
type CompanyRow = Selectable<AppCompanies>;
type JobApplicationRow = Selectable<AppJobApplications>;
type CareerEventRow = Selectable<AppCareerEvents>;

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

export interface CareerPortfolioRecord {
  id: string;
  userId: string;
  slug: string;
  title: string;
  isPublic: boolean;
  isActive: boolean;
  name: string;
  initials: string | null;
  jobTitle: string;
  bio: string;
  tagline: string;
  currentLocation: string;
  locationTagline: string | null;
  availabilityStatus: boolean;
  availabilityMessage: string | null;
  email: string;
  phone: string | null;
  theme: CareerPortfolioTheme | null;
  copyright: string | null;
  profileImageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerSocialLinksRecord {
  id: string;
  portfolioId: string;
  github: string | null;
  linkedin: string | null;
  twitter: string | null;
  website: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerPortfolioStatRecord {
  id: string;
  portfolioId: string;
  label: string;
  value: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerWorkExperienceRecord {
  id: string;
  portfolioId: string;
  role: string;
  company: string;
  description: string;
  startDate: Date | null;
  endDate: Date | null;
  baseSalary: number | null;
  currency: string;
  salaryRange: CareerSalaryRange | null;
  totalCompensation: number | null;
  equityValue: number | null;
  equityPercentage: string | null;
  signingBonus: number | null;
  annualBonus: number | null;
  bonusHistory: CareerBonusHistoryEntry[];
  benefits: CareerWorkExperienceBenefits | null;
  employmentType: string;
  workArrangement: string;
  seniorityLevel: string | null;
  department: string | null;
  teamSize: number | null;
  reportsTo: string | null;
  directReports: number;
  performanceRatings: CareerPerformanceRating[];
  salaryAdjustments: CareerSalaryAdjustment[];
  image: string | null;
  gradient: string | null;
  metrics: string | null;
  action: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  sortOrder: number;
  isVisible: boolean;
  reasonForLeaving: string | null;
  exitNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerSkillRecord {
  id: string;
  portfolioId: string;
  name: string;
  level: number;
  category: string | null;
  icon: string | null;
  description: string | null;
  yearsOfExperience: number | null;
  isVisible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerProjectRecord {
  id: string;
  portfolioId: string;
  title: string;
  description: string;
  shortDescription: string | null;
  liveUrl: string | null;
  githubUrl: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  technologies: string[];
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  workExperienceId: string | null;
  isFeatured: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerTestimonialRecord {
  id: string;
  portfolioId: string;
  name: string;
  title: string | null;
  company: string | null;
  content: string;
  avatarUrl: string | null;
  linkedinUrl: string | null;
  rating: number | null;
  isVerified: boolean;
  isVisible: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerFullPortfolioRecord extends CareerPortfolioRecord {
  socialLinks: CareerSocialLinksRecord | null;
  portfolioStats: CareerPortfolioStatRecord[];
  workExperiences: CareerWorkExperienceRecord[];
  skills: CareerSkillRecord[];
  projects: CareerProjectRecord[];
  testimonials: CareerTestimonialRecord[];
}

export interface CareerCompanyRecord {
  id: string;
  ownerUserId: string;
  name: string;
  website: string | null;
  industry: string | null;
  size: number | null;
  location: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CareerJobApplicationRecord {
  id: string;
  userId: string;
  companyId: string;
  position: string;
  status: string;
  startDate: Date;
  endDate: Date | null;
  location: string | null;
  jobPosting: string | null;
  requirements: string[];
  skills: string[];
  jobPostingUrl: string | null;
  jobPostingWordCount: number | null;
  salaryQuoted: string | null;
  salaryAccepted: string | null;
  salaryExpected: number | null;
  salaryRequested: number | null;
  salaryOffered: number | null;
  salaryNegotiated: number | null;
  salaryFinal: number | null;
  totalCompOffered: number | null;
  totalCompFinal: number | null;
  equityOffered: string | null;
  equityFinal: string | null;
  bonusOffered: number | null;
  bonusFinal: number | null;
  source: string | null;
  applicationDate: Date | null;
  responseDate: Date | null;
  firstInterviewDate: Date | null;
  offerDate: Date | null;
  decisionDate: Date | null;
  rejectionReason: string | null;
  withdrawalReason: string | null;
  timeToResponse: number | null;
  timeToFirstInterview: number | null;
  timeToOffer: number | null;
  timeToDecision: number | null;
  coverLetter: string | null;
  resume: string | null;
  jobId: string | null;
  link: string | null;
  phoneScreen: string | null;
  reference: boolean;
  interviewDates: CareerInterviewEntry[];
  companyNotes: string | null;
  negotiationNotes: string | null;
  recruiterName: string | null;
  recruiterEmail: string | null;
  recruiterLinkedin: string | null;
  stages: CareerApplicationStage[];
  createdAt: Date;
  updatedAt: Date;
  company: CareerCompanyRecord | null;
}

export interface CareerEventRecord {
  id: string;
  userId: string;
  workExperienceId: string | null;
  eventType: string;
  eventDate: Date;
  previousTitle: string | null;
  newTitle: string | null;
  previousLevel: string | null;
  newLevel: string | null;
  previousSalary: number | null;
  newSalary: number | null;
  salaryIncrease: number | null;
  increasePercentage: string | null;
  previousTotalComp: number | null;
  newTotalComp: number | null;
  totalCompIncrease: number | null;
  equityGranted: number | null;
  equityVesting: string | null;
  bonusAmount: number | null;
  bonusType: string | null;
  description: string | null;
  achievements: string[];
  skillsGained: string[];
  performanceRating: string | null;
  managerFeedback: string | null;
  selfAssessment: string | null;
  marketSalaryRange: Record<string, unknown> | null;
  careerGoals: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDefaultCareerPortfolioInput {
  userId: string;
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
}

function asObject<T>(value: unknown): T | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value : new Date(value);
}

function toRequiredDate(value: Date | string | null | undefined): Date {
  return toDate(value) ?? new Date();
}

function toPortfolioRecord(row: PortfolioRow): CareerPortfolioRecord {
  return {
    id: row.id,
    userId: row.owner_userid,
    slug: row.slug,
    title: row.title,
    isPublic: row.is_public,
    isActive: row.is_active,
    name: row.name,
    initials: row.initials,
    jobTitle: row.job_title,
    bio: row.bio,
    tagline: row.tagline,
    currentLocation: row.current_location,
    locationTagline: row.location_tagline,
    availabilityStatus: row.availability_status,
    availabilityMessage: row.availability_message,
    email: row.email,
    phone: row.phone,
    theme: asObject<CareerPortfolioTheme>(row.theme),
    copyright: row.copyright,
    profileImageUrl: row.profile_image_url,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toSocialLinksRecord(row: SocialLinksRow): CareerSocialLinksRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    github: row.github,
    linkedin: row.linkedin,
    twitter: row.twitter,
    website: row.website,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toPortfolioStatRecord(row: PortfolioStatRow): CareerPortfolioStatRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    label: row.label,
    value: row.value,
    sortOrder: row.sort_order,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toWorkExperienceRecord(row: WorkExperienceRow): CareerWorkExperienceRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    role: row.role,
    company: row.company,
    description: row.description,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    baseSalary: row.base_salary,
    currency: row.currency,
    salaryRange: asObject<CareerSalaryRange>(row.salary_range),
    totalCompensation: row.total_compensation,
    equityValue: row.equity_value,
    equityPercentage: row.equity_percentage,
    signingBonus: row.signing_bonus,
    annualBonus: row.annual_bonus,
    bonusHistory: asArray<CareerBonusHistoryEntry>(row.bonus_history),
    benefits: asObject<CareerWorkExperienceBenefits>(row.benefits),
    employmentType: row.employment_type,
    workArrangement: row.work_arrangement,
    seniorityLevel: row.seniority_level,
    department: row.department,
    teamSize: row.team_size,
    reportsTo: row.reports_to,
    directReports: row.direct_reports,
    performanceRatings: asArray<CareerPerformanceRating>(row.performance_ratings),
    salaryAdjustments: asArray<CareerSalaryAdjustment>(row.salary_adjustments),
    image: row.image,
    gradient: row.gradient,
    metrics: row.metrics,
    action: row.action,
    tags: asArray<string>(row.tags),
    metadata: asObject(row.metadata),
    sortOrder: row.sort_order,
    isVisible: row.is_visible,
    reasonForLeaving: row.reason_for_leaving,
    exitNotes: row.exit_notes,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toSkillRecord(row: SkillRow): CareerSkillRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    name: row.name,
    level: row.level,
    category: row.category,
    icon: row.icon,
    description: row.description,
    yearsOfExperience: row.years_of_experience,
    isVisible: row.is_visible,
    sortOrder: row.sort_order,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toProjectRecord(row: ProjectRow): CareerProjectRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    title: row.title,
    description: row.description,
    shortDescription: row.short_description,
    liveUrl: row.live_url,
    githubUrl: row.github_url,
    imageUrl: row.image_url,
    videoUrl: row.video_url,
    technologies: asArray<string>(row.technologies),
    status: row.status,
    startDate: toDate(row.start_date),
    endDate: toDate(row.end_date),
    workExperienceId: row.work_experience_id,
    isFeatured: row.is_featured,
    isVisible: row.is_visible,
    sortOrder: row.sort_order,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toTestimonialRecord(row: TestimonialRow): CareerTestimonialRecord {
  return {
    id: row.id,
    portfolioId: row.portfolio_id,
    name: row.name,
    title: row.title,
    company: row.company,
    content: row.content,
    avatarUrl: row.avatar_url,
    linkedinUrl: row.linkedin_url,
    rating: row.rating,
    isVerified: row.is_verified,
    isVisible: row.is_visible,
    sortOrder: row.sort_order,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toCompanyRecord(row: CompanyRow): CareerCompanyRecord {
  return {
    id: row.id,
    ownerUserId: row.owner_userid,
    name: row.name,
    website: row.website,
    industry: row.industry,
    size: row.size,
    location: row.location,
    description: row.description,
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toCareerEventRecord(row: CareerEventRow): CareerEventRecord {
  return {
    id: row.id,
    userId: row.owner_userid,
    workExperienceId: row.work_experience_id,
    eventType: row.event_type,
    eventDate: toRequiredDate(row.event_date),
    previousTitle: row.previous_title,
    newTitle: row.new_title,
    previousLevel: row.previous_level,
    newLevel: row.new_level,
    previousSalary: row.previous_salary,
    newSalary: row.new_salary,
    salaryIncrease: row.salary_increase,
    increasePercentage: row.increase_percentage,
    previousTotalComp: row.previous_total_comp,
    newTotalComp: row.new_total_comp,
    totalCompIncrease: row.total_comp_increase,
    equityGranted: row.equity_granted,
    equityVesting: row.equity_vesting,
    bonusAmount: row.bonus_amount,
    bonusType: row.bonus_type,
    description: row.description,
    achievements: asArray<string>(row.achievements),
    skillsGained: asArray<string>(row.skills_gained),
    performanceRating: row.performance_rating,
    managerFeedback: row.manager_feedback,
    selfAssessment: row.self_assessment,
    marketSalaryRange: asObject(row.market_salary_range),
    careerGoals: asObject(row.career_goals),
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
  };
}

function toJobApplicationRecord(
  row: JobApplicationRow,
  company: CompanyRow | null,
): CareerJobApplicationRecord {
  return {
    id: row.id,
    userId: row.owner_userid,
    companyId: row.company_id,
    position: row.position,
    status: row.status,
    startDate: toRequiredDate(row.start_date),
    endDate: toDate(row.end_date),
    location: row.location,
    jobPosting: row.job_posting,
    requirements: asArray<string>(row.requirements),
    skills: asArray<string>(row.skills),
    jobPostingUrl: row.job_posting_url,
    jobPostingWordCount: row.job_posting_word_count,
    salaryQuoted: row.salary_quoted,
    salaryAccepted: row.salary_accepted,
    salaryExpected: row.salary_expected,
    salaryRequested: row.salary_requested,
    salaryOffered: row.salary_offered,
    salaryNegotiated: row.salary_negotiated,
    salaryFinal: row.salary_final,
    totalCompOffered: row.total_comp_offered,
    totalCompFinal: row.total_comp_final,
    equityOffered: row.equity_offered,
    equityFinal: row.equity_final,
    bonusOffered: row.bonus_offered,
    bonusFinal: row.bonus_final,
    source: row.source,
    applicationDate: toDate(row.application_date),
    responseDate: toDate(row.response_date),
    firstInterviewDate: toDate(row.first_interview_date),
    offerDate: toDate(row.offer_date),
    decisionDate: toDate(row.decision_date),
    rejectionReason: row.rejection_reason,
    withdrawalReason: row.withdrawal_reason,
    timeToResponse: row.time_to_response,
    timeToFirstInterview: row.time_to_first_interview,
    timeToOffer: row.time_to_offer,
    timeToDecision: row.time_to_decision,
    coverLetter: row.cover_letter,
    resume: row.resume,
    jobId: row.job_id,
    link: row.link,
    phoneScreen: row.phone_screen,
    reference: row.reference,
    interviewDates: asArray<CareerInterviewEntry>(row.interview_dates),
    companyNotes: row.company_notes,
    negotiationNotes: row.negotiation_notes,
    recruiterName: row.recruiter_name,
    recruiterEmail: row.recruiter_email,
    recruiterLinkedin: row.recruiter_linkedin,
    stages: asArray<CareerApplicationStage>(row.stages),
    createdAt: toRequiredDate(row.createdat),
    updatedAt: toRequiredDate(row.updatedat),
    company: company ? toCompanyRecord(company) : null,
  };
}

async function loadFullPortfolio(
  handle: DbHandle,
  portfolio: CareerPortfolioRecord,
): Promise<CareerFullPortfolioRecord> {
  const [socialLinks, portfolioStats, workExperiences, skills, projects, testimonials] =
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
    socialLinks: socialLinks ? toSocialLinksRecord(socialLinks as SocialLinksRow) : null,
    portfolioStats: (portfolioStats as PortfolioStatRow[]).map(toPortfolioStatRecord),
    workExperiences: (workExperiences as WorkExperienceRow[]).map(toWorkExperienceRecord),
    skills: (skills as SkillRow[]).map(toSkillRecord),
    projects: (projects as ProjectRow[]).map(toProjectRecord),
    testimonials: (testimonials as TestimonialRow[]).map(toTestimonialRecord),
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

async function getOwnedPortfolioRow(handle: DbHandle, userId: string, portfolioId: string) {
  return handle
    .selectFrom('app.portfolios')
    .selectAll()
    .where('id', '=', portfolioId)
    .where('owner_userid', '=', userId)
    .executeTakeFirst();
}

async function getOwnedPortfolioRowOrThrow(handle: DbHandle, userId: string, portfolioId: string) {
  const portfolio = await getOwnedPortfolioRow(handle, userId, portfolioId);
  if (!portfolio) {
    throw new NotFoundError('Portfolio', { portfolioId, userId });
  }
  return portfolio as PortfolioRow;
}

export const CareerRepository = {
  async getPortfolioByUserId(
    handle: DbHandle,
    userId: string,
  ): Promise<CareerPortfolioRecord | null> {
    const portfolio = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    return portfolio ? toPortfolioRecord(portfolio as PortfolioRow) : null;
  },

  async getPortfolioBySlug(handle: DbHandle, slug: string): Promise<CareerPortfolioRecord | null> {
    const portfolio = await handle
      .selectFrom('app.portfolios')
      .selectAll()
      .where(sql<string>`lower(slug)`, '=', slug.toLowerCase())
      .executeTakeFirst();

    return portfolio ? toPortfolioRecord(portfolio as PortfolioRow) : null;
  },

  async loadFullPortfolioByUserId(
    handle: DbHandle,
    userId: string,
  ): Promise<CareerFullPortfolioRecord | null> {
    const portfolio = await CareerRepository.getPortfolioByUserId(handle, userId);
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
        owner_userid: input.userId,
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

    return toPortfolioRecord(created as PortfolioRow);
  },

  async deletePortfolioByUserId(handle: DbHandle, userId: string): Promise<void> {
    await handle.deleteFrom('app.portfolios').where('owner_userid', '=', userId).execute();
  },

  async deletePortfolio(handle: DbHandle, userId: string, portfolioId: string): Promise<void> {
    await handle
      .deleteFrom('app.portfolios')
      .where('id', '=', portfolioId)
      .where('owner_userid', '=', userId)
      .execute();
  },

  async updatePortfolioSlug(
    handle: DbHandle,
    userId: string,
    portfolioId: string,
    slug: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    await handle
      .updateTable('app.portfolios')
      .set({ slug })
      .where('id', '=', portfolioId)
      .where('owner_userid', '=', userId)
      .executeTakeFirstOrThrow();
  },

  async updatePortfolioProfileImage(
    handle: DbHandle,
    userId: string,
    profileImageUrl: string,
  ): Promise<void> {
    const portfolio = await CareerRepository.getPortfolioByUserId(handle, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio', { userId });
    }

    await handle
      .updateTable('app.portfolios')
      .set({ profile_image_url: profileImageUrl })
      .where('id', '=', portfolio.id)
      .executeTakeFirstOrThrow();
  },

  async findOrCreateCompany(
    handle: DbHandle,
    userId: string,
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
      .where('owner_userid', '=', userId)
      .where(sql<string>`lower(name)`, '=', normalizedName.toLowerCase())
      .executeTakeFirst();

    if (existing) {
      return toCompanyRecord(existing as CompanyRow);
    }

    const created = await handle
      .insertInto('app.companies')
      .values({
        owner_userid: userId,
        name: normalizedName,
        website: input.website ?? null,
        industry: input.industry ?? null,
        size: input.size ?? null,
        location: input.location ?? null,
        description: input.description ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toCompanyRecord(created as CompanyRow);
  },

  async createJobApplication(
    handle: DbHandle,
    userId: string,
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
      .where('owner_userid', '=', userId)
      .executeTakeFirst();

    if (!company) {
      throw new NotFoundError('Company', { companyId: input.companyId, userId });
    }

    const created = await handle
      .insertInto('app.job_applications')
      .values({
        owner_userid: userId,
        company_id: input.companyId,
        position: input.position,
        status: input.status,
        start_date: new Date(input.startDate),
        end_date: input.endDate ? new Date(input.endDate) : null,
        location: input.location ?? null,
        job_posting: input.jobPosting ?? null,
        requirements: (input.requirements ?? []) as JsonValue,
        skills: (input.skills ?? []) as JsonValue,
        job_posting_url: input.jobPostingUrl ?? null,
        job_posting_word_count: input.jobPostingWordCount ?? null,
        salary_quoted: input.salaryQuoted ?? null,
        salary_accepted: input.salaryAccepted ?? null,
        salary_offered: input.salaryOffered ?? null,
        salary_final: input.salaryFinal ?? null,
        source: input.source ?? null,
        application_date: input.applicationDate ? new Date(input.applicationDate) : null,
        link: input.link ?? null,
        recruiter_name: input.recruiterName ?? null,
        recruiter_email: input.recruiterEmail ?? null,
        recruiter_linkedin: input.recruiterLinkedin ?? null,
        reference: input.reference ?? false,
        stages: (input.stages ?? []) as unknown as JsonValue,
        interview_dates: (input.interviewDates ?? []) as unknown as JsonValue,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toJobApplicationRecord(created as JobApplicationRow, company as CompanyRow);
  },

  async updateJobApplicationStatus(
    handle: DbHandle,
    userId: string,
    applicationId: string,
    status: string,
  ): Promise<void> {
    await handle
      .updateTable('app.job_applications')
      .set({ status })
      .where('id', '=', applicationId)
      .where('owner_userid', '=', userId)
      .executeTakeFirstOrThrow();
  },

  async deleteJobApplication(
    handle: DbHandle,
    userId: string,
    applicationId: string,
  ): Promise<void> {
    await handle
      .deleteFrom('app.job_applications')
      .where('id', '=', applicationId)
      .where('owner_userid', '=', userId)
      .executeTakeFirstOrThrow();
  },

  async listUserWorkExperiences(
    handle: DbHandle,
    userId: string,
    direction: 'asc' | 'desc' = 'asc',
  ): Promise<CareerWorkExperienceRecord[]> {
    const rows = await handle
      .selectFrom('app.work_experiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolio_id')
      .selectAll('workExperience')
      .where('portfolio.owner_userid', '=', userId)
      .orderBy('workExperience.start_date', direction)
      .execute();

    return (rows as WorkExperienceRow[]).map(toWorkExperienceRecord);
  },

  async getWorkExperienceById(
    handle: DbHandle,
    userId: string,
    experienceId: string,
  ): Promise<CareerWorkExperienceRecord | null> {
    const row = await handle
      .selectFrom('app.work_experiences as workExperience')
      .innerJoin('app.portfolios as portfolio', 'portfolio.id', 'workExperience.portfolio_id')
      .selectAll('workExperience')
      .where('portfolio.owner_userid', '=', userId)
      .where('workExperience.id', '=', experienceId)
      .executeTakeFirst();

    return row ? toWorkExperienceRecord(row as WorkExperienceRow) : null;
  },

  async updateWorkExperience(
    handle: DbHandle,
    userId: string,
    experienceId: string,
    updates: UpdateCareerWorkExperienceInput,
  ): Promise<CareerWorkExperienceRecord> {
    const existing = await CareerRepository.getWorkExperienceById(handle, userId, experienceId);
    if (!existing) {
      throw new NotFoundError('WorkExperience', { experienceId, userId });
    }

    const updated = await handle
      .updateTable('app.work_experiences')
      .set({
        ...(updates.role !== undefined ? { role: updates.role } : {}),
        ...(updates.company !== undefined ? { company: updates.company } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.startDate !== undefined
          ? { start_date: updates.startDate ? new Date(updates.startDate) : null }
          : {}),
        ...(updates.endDate !== undefined
          ? { end_date: updates.endDate ? new Date(updates.endDate) : null }
          : {}),
        ...(updates.action !== undefined ? { action: updates.action } : {}),
        ...(updates.tags !== undefined ? { tags: updates.tags as unknown as JsonValue } : {}),
        ...(updates.metadata !== undefined
          ? { metadata: updates.metadata as unknown as JsonValue }
          : {}),
        ...(updates.sortOrder !== undefined ? { sort_order: updates.sortOrder } : {}),
        ...(updates.isVisible !== undefined ? { is_visible: updates.isVisible } : {}),
      })
      .where('id', '=', experienceId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return toWorkExperienceRecord(updated as WorkExperienceRow);
  },

  async listProjectsByPortfolio(
    handle: DbHandle,
    portfolioId: string,
  ): Promise<CareerProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolio_id', '=', portfolioId)
      .orderBy('createdat', 'desc')
      .execute();

    return (rows as ProjectRow[]).map(toProjectRecord);
  },

  async listProjectsByWorkExperience(
    handle: DbHandle,
    portfolioId: string,
    workExperienceId: string,
  ): Promise<CareerProjectRecord[]> {
    const rows = await handle
      .selectFrom('app.projects')
      .selectAll()
      .where('portfolio_id', '=', portfolioId)
      .where('work_experience_id', '=', workExperienceId)
      .orderBy('createdat', 'desc')
      .execute();

    return (rows as ProjectRow[]).map(toProjectRecord);
  },

  async listUserCareerEvents(
    handle: DbHandle,
    userId: string,
    limit?: number,
  ): Promise<CareerEventRecord[]> {
    let query = handle
      .selectFrom('app.career_events')
      .selectAll()
      .where('owner_userid', '=', userId)
      .orderBy('event_date', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const rows = await query.execute();
    return (rows as CareerEventRow[]).map(toCareerEventRecord);
  },

  async getApplicationById(
    handle: DbHandle,
    userId: string,
    applicationId: string,
  ): Promise<CareerJobApplicationRecord | null> {
    const rows = await handle
      .selectFrom('app.job_applications as application')
      .leftJoin('app.companies as company', 'company.id', 'application.company_id')
      .selectAll('application')
      .select([
        'company.id as company_id_joined',
        'company.owner_userid as company_owner_userid',
        'company.name as company_name',
        'company.website as company_website',
        'company.industry as company_industry',
        'company.size as company_size',
        'company.location as company_location',
        'company.description as company_description',
        'company.createdat as company_createdat',
        'company.updatedat as company_updatedat',
      ])
      .where('application.owner_userid', '=', userId)
      .where('application.id', '=', applicationId)
      .limit(1)
      .execute();

    if (rows.length === 0) return null;

    const row = rows[0];
    const application = row as unknown as JobApplicationRow & {
      company_id_joined: string | null;
      company_owner_userid: string | null;
      company_name: string | null;
      company_website: string | null;
      company_industry: string | null;
      company_size: number | null;
      company_location: string | null;
      company_description: string | null;
      company_createdat: Date | string | null;
      company_updatedat: Date | string | null;
    };

    const company = application.company_id_joined
      ? ({
          id: application.company_id_joined,
          owner_userid: application.company_owner_userid ?? '',
          name: application.company_name ?? '',
          website: application.company_website,
          industry: application.company_industry,
          size: application.company_size,
          location: application.company_location,
          description: application.company_description,
          createdat: application.company_createdat ?? new Date().toISOString(),
          updatedat: application.company_updatedat ?? new Date().toISOString(),
        } as CompanyRow)
      : null;

    return toJobApplicationRecord(application, company);
  },

  async listUserJobApplicationsWithCompany(
    handle: DbHandle,
    userId: string,
  ): Promise<CareerJobApplicationRecord[]> {
    const rows = await handle
      .selectFrom('app.job_applications as application')
      .leftJoin('app.companies as company', 'company.id', 'application.company_id')
      .selectAll('application')
      .select([
        'company.id as company_id_joined',
        'company.owner_userid as company_owner_userid',
        'company.name as company_name',
        'company.website as company_website',
        'company.industry as company_industry',
        'company.size as company_size',
        'company.location as company_location',
        'company.description as company_description',
        'company.createdat as company_createdat',
        'company.updatedat as company_updatedat',
      ])
      .where('application.owner_userid', '=', userId)
      .orderBy('application.application_date', 'desc')
      .execute();

    return rows.map((row) => {
      const application = row as unknown as JobApplicationRow & {
        company_id_joined: string | null;
        company_owner_userid: string | null;
        company_name: string | null;
        company_website: string | null;
        company_industry: string | null;
        company_size: number | null;
        company_location: string | null;
        company_description: string | null;
        company_createdat: Date | string | null;
        company_updatedat: Date | string | null;
      };

      const company = application.company_id_joined
        ? ({
            id: application.company_id_joined,
            owner_userid: application.company_owner_userid ?? '',
            name: application.company_name ?? '',
            website: application.company_website,
            industry: application.company_industry,
            size: application.company_size,
            location: application.company_location,
            description: application.company_description,
            createdat: application.company_createdat ?? new Date().toISOString(),
            updatedat: application.company_updatedat ?? new Date().toISOString(),
          } as CompanyRow)
        : null;

      return toJobApplicationRecord(application, company);
    });
  },

  async savePortfolioBasics(
    handle: DbHandle,
    userId: string,
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
    const existing = await CareerRepository.getPortfolioByUserId(handle, userId);

    if (existing) {
      const updated = await handle
        .updateTable('app.portfolios')
        .set({
          name: input.name,
          initials: input.initials ?? null,
          job_title: input.jobTitle,
          title: input.title ?? `${input.name}'s Portfolio`,
          bio: input.bio,
          tagline: input.tagline,
          current_location: input.currentLocation,
          location_tagline: input.locationTagline ?? null,
          email: input.email,
          phone: input.phone ?? null,
          availability_status: input.availabilityStatus ?? false,
          availability_message: input.availabilityMessage ?? null,
          ...(input.theme !== undefined ? { theme: input.theme as JsonValue } : {}),
          ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
          ...(input.isPublic !== undefined ? { is_public: input.isPublic } : {}),
          ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
        })
        .where('id', '=', existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();

      return toPortfolioRecord(updated as PortfolioRow);
    }

    const created = await handle
      .insertInto('app.portfolios')
      .values({
        owner_userid: userId,
        slug: createPortfolioSlug(input.name),
        name: input.name,
        initials: input.initials ?? null,
        job_title: input.jobTitle,
        title: input.title ?? `${input.name}'s Portfolio`,
        bio: input.bio,
        tagline: input.tagline,
        current_location: input.currentLocation,
        location_tagline: input.locationTagline ?? null,
        email: input.email,
        phone: input.phone ?? null,
        availability_status: input.availabilityStatus ?? false,
        availability_message: input.availabilityMessage ?? null,
        ...(input.theme !== undefined ? { theme: input.theme as JsonValue } : {}),
        ...(input.copyright !== undefined ? { copyright: input.copyright } : {}),
        ...(input.isPublic !== undefined ? { is_public: input.isPublic } : {}),
        ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toPortfolioRecord(created as PortfolioRow);
  },

  async saveSocialLinks(
    handle: DbHandle,
    userId: string,
    portfolioId: string,
    input: {
      id?: string;
      github?: string | null;
      linkedin?: string | null;
      twitter?: string | null;
      website?: string | null;
    },
  ): Promise<CareerSocialLinksRecord> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    const existing = await handle
      .selectFrom('app.social_links')
      .selectAll()
      .where('portfolio_id', '=', portfolioId)
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

      return toSocialLinksRecord(updated as SocialLinksRow);
    }

    const created = await handle
      .insertInto('app.social_links')
      .values({
        portfolio_id: portfolioId,
        github: input.github ?? null,
        linkedin: input.linkedin ?? null,
        twitter: input.twitter ?? null,
        website: input.website ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toSocialLinksRecord(created as SocialLinksRow);
  },

  async replacePortfolioStats(
    handle: DbHandle,
    userId: string,
    portfolioId: string,
    stats: Array<{ id?: string; label: string; value: string; sortOrder?: number }>,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    const current = await handle
      .selectFrom('app.portfolio_stats')
      .select(['id'])
      .where('portfolio_id', '=', portfolioId)
      .execute();

    const currentIds = current.map((item) => item.id);
    const submittedIds = stats.flatMap((item) => (item.id ? [item.id] : []));
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id));

    if (toDelete.length > 0) {
      await handle
        .deleteFrom('app.portfolio_stats')
        .where('portfolio_id', '=', portfolioId)
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
            sort_order: stat.sortOrder ?? index,
          })
          .where('id', '=', stat.id)
          .where('portfolio_id', '=', portfolioId)
          .execute();
      } else {
        await handle
          .insertInto('app.portfolio_stats')
          .values({
            portfolio_id: portfolioId,
            label: stat.label,
            value: stat.value,
            sort_order: stat.sortOrder ?? index,
          })
          .execute();
      }
    }
  },

  async replaceSkills(
    handle: DbHandle,
    userId: string,
    portfolioId: string,
    skills: Array<{ id?: string; name: string; category?: string | null; level: number }>,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    const current = await handle
      .selectFrom('app.skills')
      .select(['id'])
      .where('portfolio_id', '=', portfolioId)
      .execute();

    const currentIds = current.map((item) => item.id);
    const submittedIds = skills.flatMap((item) => (item.id ? [item.id] : []));
    const toDelete = currentIds.filter((id) => !submittedIds.includes(id));

    if (toDelete.length > 0) {
      await handle
        .deleteFrom('app.skills')
        .where('portfolio_id', '=', portfolioId)
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
          .where('portfolio_id', '=', portfolioId)
          .execute();
      } else {
        await handle
          .insertInto('app.skills')
          .values({
            portfolio_id: portfolioId,
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
    userId: string,
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
    await getOwnedPortfolioRowOrThrow(handle, userId, input.portfolioId);

    const created = await handle
      .insertInto('app.projects')
      .values({
        portfolio_id: input.portfolioId,
        work_experience_id: input.workExperienceId ?? null,
        title: input.title,
        description: input.description,
        short_description: input.shortDescription ?? null,
        live_url: input.liveUrl ?? null,
        github_url: input.githubUrl ?? null,
        image_url: input.imageUrl ?? null,
        video_url: input.videoUrl ?? null,
        technologies: (input.technologies ?? []) as JsonValue,
        status: input.status ?? 'completed',
        start_date: input.startDate ? new Date(input.startDate) : null,
        end_date: input.endDate ? new Date(input.endDate) : null,
        is_featured: input.isFeatured ?? false,
        is_visible: input.isVisible ?? true,
        sort_order: input.sortOrder ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toProjectRecord(created as ProjectRow);
  },

  async updateProject(
    handle: DbHandle,
    userId: string,
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
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    await handle
      .updateTable('app.projects')
      .set({
        title: input.title,
        description: input.description,
        short_description: input.shortDescription ?? null,
        live_url: input.liveUrl ?? null,
        github_url: input.githubUrl ?? null,
        image_url: input.imageUrl ?? null,
        video_url: input.videoUrl ?? null,
        technologies: (input.technologies ?? []) as JsonValue,
        status: input.status ?? 'completed',
        work_experience_id: input.workExperienceId ?? null,
        start_date: input.startDate ? new Date(input.startDate) : null,
        end_date: input.endDate ? new Date(input.endDate) : null,
        is_featured: input.isFeatured ?? false,
        is_visible: input.isVisible ?? true,
        sort_order: input.sortOrder ?? 0,
      })
      .where('id', '=', projectId)
      .where('portfolio_id', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async deleteProject(
    handle: DbHandle,
    userId: string,
    projectId: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    await handle
      .deleteFrom('app.projects')
      .where('id', '=', projectId)
      .where('portfolio_id', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async createTestimonial(
    handle: DbHandle,
    userId: string,
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
    await getOwnedPortfolioRowOrThrow(handle, userId, input.portfolioId);

    const created = await handle
      .insertInto('app.testimonials')
      .values({
        portfolio_id: input.portfolioId,
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatar_url: input.avatarUrl ?? null,
        linkedin_url: input.linkedinUrl ?? null,
        rating: input.rating ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toTestimonialRecord(created as TestimonialRow);
  },

  async updateTestimonial(
    handle: DbHandle,
    userId: string,
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
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    await handle
      .updateTable('app.testimonials')
      .set({
        name: input.name,
        title: input.title ?? null,
        company: input.company ?? null,
        content: input.content,
        avatar_url: input.avatarUrl ?? null,
        linkedin_url: input.linkedinUrl ?? null,
        rating: input.rating ?? null,
      })
      .where('id', '=', testimonialId)
      .where('portfolio_id', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async deleteTestimonial(
    handle: DbHandle,
    userId: string,
    testimonialId: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    await handle
      .deleteFrom('app.testimonials')
      .where('id', '=', testimonialId)
      .where('portfolio_id', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },

  async createWorkExperience(
    handle: DbHandle,
    userId: string,
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
    await getOwnedPortfolioRowOrThrow(handle, userId, input.portfolioId);

    const created = await handle
      .insertInto('app.work_experiences')
      .values({
        portfolio_id: input.portfolioId,
        role: input.role,
        company: input.company,
        description: input.description,
        start_date: input.startDate ? new Date(input.startDate) : null,
        end_date: input.endDate ? new Date(input.endDate) : null,
        action: input.action ?? null,
        ...(input.tags !== undefined ? { tags: input.tags as JsonValue } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata as JsonValue } : {}),
        sort_order: input.sortOrder ?? 0,
        is_visible: input.isVisible ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return toWorkExperienceRecord(created as WorkExperienceRow);
  },

  async deleteWorkExperience(
    handle: DbHandle,
    userId: string,
    experienceId: string,
    portfolioId: string,
  ): Promise<void> {
    await getOwnedPortfolioRowOrThrow(handle, userId, portfolioId);

    await handle
      .deleteFrom('app.work_experiences')
      .where('id', '=', experienceId)
      .where('portfolio_id', '=', portfolioId)
      .executeTakeFirstOrThrow();
  },
};
