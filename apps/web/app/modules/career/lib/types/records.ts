// Career record shapes used by the web sub-app. Mirrors the DB select types so the
// platform never imports @hominem/db for a type (docs/web.sub-apps.md).
type Generated<T> = T;
type ColumnType<Select, _Insert = Select, _Update = Select> = Select;
type Json = unknown;
export type AppCareerApplicationStageKind = 'APPLICATION' | 'OFFER' | 'OUTCOME' | 'SCREEN';

export type AppCareerApplicationStatus =
  | 'ACCEPTED'
  | 'APPLIED'
  | 'OFFER'
  | 'REJECTED'
  | 'SCREENING'
  | 'WISHLIST'
  | 'WITHDRAWN';

export type AppCareerEngagementKind =
  | 'CONTRACT'
  | 'EMPLOYMENT'
  | 'FREELANCE'
  | 'OTHER'
  | 'VOLUNTEER';

export type AppCareerOfferDecision = 'ACCEPTED' | 'DECLINED' | 'NEGOTIATING' | 'PENDING';

export type AppCareerProjectStatus = 'BACKLOG' | 'CANCELED' | 'DONE' | 'IN_PROGRESS';

export type AppCareerWorklogImpactStatus = 'closed' | 'open';

export type AppCareerWorklogSensitivity = 'internal' | 'mixed' | 'public_safe';

export interface AppCareerApplicationFiles {
  applicationId: string;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  fileName: string;
  fileType: string | null;
  fileUrl: string;
  id: Generated<string>;
}

export interface AppCareerApplicationNotes {
  applicationId: string;
  content: string;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  id: Generated<string>;
}

export interface AppCareerApplications {
  appliedAt: ColumnType<string, Date | string, Date | string> | null;
  company: string;
  coverLetterUrl: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  currentStageId: string | null;
  externalId: string | null;
  id: Generated<string>;
  jobPostingUrl: string | null;
  legacyId: string | null;
  location: string | null;
  notes: string | null;
  ownerUserid?: string;
  postedAt: ColumnType<string, Date | string, Date | string> | null;
  postingText: string | null;
  referredBy: string | null;
  resumeUrl: string | null;
  salaryCurrency: string | null;
  salaryExpectation: number | null;
  salaryMax: number | null;
  salaryMin: number | null;
  source: string | null;
  status: AppCareerApplicationStatus;
  title: string;
  engagements?: Array<{ id: string }>;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
}

export interface AppCareerApplicationsOffers {
  applicationId: string;
  baseSalary: number | null;
  bonus: number | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  currency: Generated<string | null>;
  decision: Generated<AppCareerOfferDecision>;
  decisionAt: ColumnType<string, Date | string, Date | string> | null;
  equity: string | null;
  id: Generated<string>;
  notes: string | null;
  signingBonus: number | null;
  stageId: string;
  totalComp: number | null;
}

export interface AppCareerApplicationStages {
  applicationId: string;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  enteredAt: ColumnType<string, Date | string, Date | string> | null;
  exitedAt: ColumnType<string, Date | string, Date | string> | null;
  id: Generated<string>;
  notes: string | null;
  stage: string;
  stageKind: AppCareerApplicationStageKind;
  stageOrder: number;
}

export interface AppCareerCertifications {
  category: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  description: string | null;
  expirationDate: ColumnType<string, Date | string, Date | string> | null;
  id: Generated<string>;
  issueDate: ColumnType<string, Date | string, Date | string> | null;
  issuingOrganization: string;
  isVisible: Generated<boolean>;
  name: string;
  ownerUserid?: string;
  positionId: string | null;
  sortOrder: Generated<number>;
  status: Generated<string | null>;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
}

export interface AppCareerEducation {
  activities: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  degree: string | null;
  endDate: ColumnType<string, Date | string, Date | string> | null;
  fieldOfStudy: string | null;
  id: Generated<string>;
  notes: string | null;
  ownerUserid?: string;
  school: string;
  startDate: ColumnType<string, Date | string, Date | string> | null;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
}

export interface AppCareerEngagements {
  address: string | null;
  company: string;
  contactName: string | null;
  contactPhone: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  currency: Generated<string | null>;
  description: string | null;
  endDate: ColumnType<string, Date | string, Date | string> | null;
  id: Generated<string>;
  isCurrent: Generated<boolean | null>;
  kind: Generated<AppCareerEngagementKind>;
  location: string | null;
  ownerUserid?: string;
  reasonForLeaving: string | null;
  salaryHigh: number | null;
  salaryLow: number | null;
  source: Generated<string | null>;
  startDate: ColumnType<string, Date | string, Date | string> | null;
  title: string;
  engagements?: Array<{ id: string }>;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  url: string | null;
}

export interface AppCareerProfile {
  availabilityStatus: Generated<boolean>;
  birthDate?: ColumnType<string, Date | string, Date | string> | null;
  copyright: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  email: string | null;
  firstName: string | null;
  headline: string | null;
  id: Generated<string>;
  industry: string | null;
  initials: string | null;
  isActive?: Generated<boolean>;
  isPublic: Generated<boolean>;
  lastName: string | null;
  linkedinUrl: string | null;
  location: string | null;
  openToRemote: Generated<boolean>;
  ownerUserid?: string;
  phone: string | null;
  profileImageUrl: string | null;
  registeredAt?: ColumnType<string, Date | string, Date | string> | null;
  slug: string | null;
  summary: string | null;
  tagline: string | null;
  title: string | null;
  twitterHandles: string | null;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  websites: string | null;
}

export interface AppCareerProjects {
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  description: string | null;
  endDate: ColumnType<string, Date | string, Date | string> | null;
  githubUrl: string | null;
  id: Generated<string>;
  isFeatured: Generated<boolean>;
  isVisible: Generated<boolean>;
  liveUrl: string | null;
  organization: string | null;
  ownerUserid?: string;
  shortDescription: string | null;
  sortOrder: Generated<number>;
  startDate: ColumnType<string, Date | string, Date | string> | null;
  status: Generated<AppCareerProjectStatus | null>;
  technologies: Generated<Json>;
  title: string;
  engagements?: Array<{ id: string }>;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  videoUrl: string | null;
}

export interface AppCareerSkills {
  aiDerived: Generated<boolean>;
  category: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  description: string | null;
  id: Generated<string>;
  isVisible: Generated<boolean>;
  level: number | null;
  name: string;
  ownerUserid?: string;
  proof: string | null;
  sortOrder: Generated<number>;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  worklogEntryIds: Generated<Json>;
  yearsOfExperience: number | null;
}

export interface AppCareerSocialLinks {
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  github: string | null;
  id?: string;
  linkedin: string | null;
  ownerUserid?: string;
  twitter: string | null;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  website: string | null;
}

export interface AppCareerTestimonials {
  avatarUrl: string | null;
  company: string | null;
  content: string;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  id: Generated<string>;
  isVerified: Generated<boolean>;
  isVisible: Generated<boolean>;
  linkedinUrl: string | null;
  name: string;
  ownerUserid?: string;
  rating: number | null;
  sortOrder: Generated<number>;
  title: string | null;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
}

export interface AppCareerWorklogEntries {
  action: string | null;
  area: string | null;
  createdAt?: Generated<ColumnType<string, Date | string, Date | string>>;
  engagementId: string;
  evidence: Generated<Json>;
  id: Generated<string>;
  impact: string | null;
  impactStatus: Generated<AppCareerWorklogImpactStatus>;
  knownLimits: string | null;
  loggedAt: Generated<ColumnType<string, Date | string, Date | string>>;
  occurredEnd: ColumnType<string, Date | string, Date | string> | null;
  occurredStart: Generated<ColumnType<string, Date | string, Date | string>>;
  ownerUserid?: string;
  problem: string | null;
  projectId: string | null;
  publicBullet: string | null;
  rawNote: string;
  sensitivity: Generated<AppCareerWorklogSensitivity>;
  tags: Generated<Json>;
  updatedAt?: Generated<ColumnType<string, Date | string, Date | string>>;
}

export type CareerProfileRecord = AppCareerProfile;
export type CareerEngagementRecord = AppCareerEngagements;
export type CareerEducationRecord = AppCareerEducation;
export type CareerApplicationRecord = AppCareerApplications;
export type CareerApplicationStageRecord = AppCareerApplicationStages;
export type CareerOfferRecord = AppCareerApplicationsOffers;
export type CareerProjectRecord = AppCareerProjects;
export type CareerSkillRecord = AppCareerSkills;
export type CareerTestimonialRecord = AppCareerTestimonials;
export type CareerCertificationRecord = AppCareerCertifications;
export type CareerSocialLinksRecord = AppCareerSocialLinks;
export type CareerWorklogEntry = AppCareerWorklogEntries;
export type CareerApplicationFileRecord = AppCareerApplicationFiles;
export type CareerApplicationNoteRecord = AppCareerApplicationNotes;

export type CareerApplicationWithRelations = CareerApplicationRecord & {
  currentStage: string | null;
  stages: CareerApplicationStageRecord[];
  offers: CareerOfferRecord[];
};
