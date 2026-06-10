import type {
  CareerApplicationStage,
  CareerCertificationRecord,
  CareerCompanyRecord,
  CareerInterviewEntry,
  CareerJobApplicationRecord,
  CareerProjectRecord,
  CareerWorkExperienceRecord,
} from '@hominem/db';

export type Project = CareerProjectRecord;
export type WorkExperience = CareerWorkExperienceRecord;
export type Company = CareerCompanyRecord;
export type ApplicationWithCompany = CareerJobApplicationRecord;
export type InterviewEntry = CareerInterviewEntry;
export type ApplicationStage = CareerApplicationStage;

export interface WorkExperienceMetadata {
  company_size?: string;
  industry?: string;
  location?: string;
  website?: string;
  achievements?: string[];
  technologies?: string[];
}

export interface ApplicationNote {
  id: string;
  applicationId: string;
  type: string;
  title: string | null;
  content: string;
  isPrivate: boolean;
  createdat: Date;
  updatedat: Date;
}

export interface ApplicationFile {
  id: string;
  applicationId: string;
  type: string;
  fileName: string;
  fileUrl: string | null;
  fileContent: string | null;
  mimeType: string | null;
  fileSize: number | null;
  createdat: Date;
  updatedat: Date;
}

export type Certification = CareerCertificationRecord;

export interface ApplicationWithRelations {
  application: ApplicationWithCompany;
  notes: ApplicationNote[];
  files: ApplicationFile[];
}

export interface WorkExperienceWithFinancials extends WorkExperience {
  totalTenure?: number;
  currentAnnualizedSalary?: number;
  totalCompensationReceived?: number;
  averageAnnualRaise?: number;
  promotionCount?: number;
  skillsAcquired?: string[];
}

export interface CareerProgressionSummary {
  totalExperience: number;
  currentSalary: number;
  firstSalary: number;
  totalSalaryGrowth: number;
  salaryGrowthPercentage: number;
  averageAnnualGrowth: number;
  promotionCount: number;
  jobChangeCount: number;
  averageTenurePerJob: number;
  highestSalaryIncrease: {
    amount: number;
    percentage: number;
    reason: string;
    date: string;
  };
  salaryByYear: Array<{
    year: number;
    salary: number;
    totalComp: number;
    company: string;
    title: string;
  }>;
  currentLevel: string;
  levelProgression: Array<{
    level: string;
    start_date: string;
    end_date?: string;
    duration: number;
  }>;
}

export interface JobApplicationUpdate {
  position?: string;
  status?: string;
  location?: string | null;
  job_posting?: string | null;
  salary_quoted?: string | null;
  salary_accepted?: string | null;
  company_notes?: string | null;
  negotiation_notes?: string | null;
  recruiter_name?: string | null;
  recruiter_email?: string | null;
  recruiter_linkedin?: string | null;
  updatedat?: Date;
}

export interface JobApplicationMetrics {
  totalApplications: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  acceptanceRate: number;
  averageTimeToResponse: number;
  averageTimeToOffer: number;
  averageTimeToDecision: number;
  salaryMetrics: {
    averageOffered: number;
    averageAccepted: number;
    negotiationSuccessRate: number;
    averageNegotiationIncrease: number;
  };
  sourceMetrics: Array<{
    source: string;
    count: number;
    responseRate: number;
    offerRate: number;
  }>;
  statusBreakdown: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

export interface CertificationSummary {
  totalCertifications: number;
  activeCertifications: number;
  expiredCertifications: number;
  expiringInSixMonths: number;
  categories: Array<{
    category: string;
    count: number;
  }>;
  totalInvestment: number;
  upcomingRenewals: Array<{
    id: string;
    name: string;
    expirationDate: string;
    daysUntilExpiration: number;
  }>;
  certificationsByYear: Array<{
    year: number;
    count: number;
    totalCost: number;
  }>;
}
