import type {
  ApplicationFile,
  ApplicationNote,
  CareerEvent,
  Certification,
  Company,
  JobApplication,
  Project,
  WorkExperience,
} from './tables'
import type { InterviewEntry } from './types'

// Enhanced project with relations
export interface ProjectWithRelations extends Project {
  workExperience?: WorkExperience
}

// Enhanced application type with company data
export interface ApplicationWithCompany extends Omit<JobApplication, 'companyId'> {
  company: Company | null
  interviewDates: InterviewEntry[] | null
  companyNotes: string | null
  negotiationNotes: string | null
}

// Complete application data with all relations
export interface ApplicationWithRelations {
  application: ApplicationWithCompany
  notes: ApplicationNote[]
  files: ApplicationFile[]
}

// Enhanced work experience with financial data
export interface WorkExperienceWithFinancials extends WorkExperience {
  // Calculated fields for dashboard
  totalTenure?: number // days
  currentAnnualizedSalary?: number // in cents, accounting for raises
  totalCompensationReceived?: number // in cents, including all bonuses
  averageAnnualRaise?: number // percentage
  promotionCount?: number
  skillsAcquired?: string[]
}

// Career event with related data
export interface CareerEventWithContext extends CareerEvent {
  workExperience?: WorkExperience
  relatedEvents?: CareerEvent[] // other events from same time period
  marketContext?: {
    industryGrowth?: number
    roleMarketMedian?: number
    locationCostOfLiving?: number
  }
}

// Career progression summary for dashboard
export interface CareerProgressionSummary {
  totalExperience: number // years
  currentSalary: number // in cents
  firstSalary: number // in cents
  totalSalaryGrowth: number // in cents
  salaryGrowthPercentage: number
  averageAnnualGrowth: number // percentage

  promotionCount: number
  jobChangeCount: number
  averageTenurePerJob: number // years

  highestSalaryIncrease: {
    amount: number
    percentage: number
    reason: string
    date: string
  }

  salaryByYear: Array<{
    year: number
    salary: number
    totalComp: number
    company: string
    title: string
  }>

  currentLevel: string
  levelProgression: Array<{
    level: string
    startDate: string
    endDate?: string
    duration: number // months
  }>
}

// Financial metrics for dashboard
export interface FinancialMetrics {
  // Current state
  currentSalary: number
  currentTotalComp: number

  // Growth metrics
  totalCareerGrowth: number // percentage from first to current salary
  compoundAnnualGrowthRate: number // CAGR percentage

  // Yearly breakdown
  salaryHistory: Array<{
    year: number
    baseSalary: number
    totalComp: number
    bonuses: number
    equityValue: number
    company: string
    role: string
  }>

  // Job change analysis
  jobChangeImpact: Array<{
    changeDate: string
    fromCompany: string
    toCompany: string
    salaryIncrease: number
    percentageIncrease: number
    totalCompIncrease: number
  }>

  // Market positioning
  marketComparison: {
    percentileRank?: number // where you stand vs market
    marketMedian?: number
    marketRange?: { min: number; max: number }
    lastUpdated?: string
  }
}

// Type for job application updates
export interface JobApplicationUpdate {
  position?: string
  status?: string
  location?: string | null
  jobPosting?: string | null
  salaryQuoted?: string | null
  salaryAccepted?: string | null
  companyNotes?: string | null
  negotiationNotes?: string | null
  recruiterName?: string | null
  recruiterEmail?: string | null
  recruiterLinkedin?: string | null
  updatedAt?: Date
}

// Job application metrics for dashboard
export interface JobApplicationMetrics {
  totalApplications: number
  responseRate: number // percentage
  interviewRate: number // percentage
  offerRate: number // percentage
  acceptanceRate: number // percentage

  averageTimeToResponse: number // days
  averageTimeToOffer: number // days
  averageTimeToDecision: number // days

  salaryMetrics: {
    averageOffered: number
    averageAccepted: number
    negotiationSuccessRate: number // percentage
    averageNegotiationIncrease: number // percentage
  }

  sourceMetrics: Array<{
    source: string
    count: number
    responseRate: number
    offerRate: number
  }>

  statusBreakdown: Array<{
    status: string
    count: number
    percentage: number
  }>
}

// Bonus/equity tracking
export interface BonusEntry {
  type: 'annual' | 'signing' | 'performance' | 'retention' | 'spot'
  amount: number // in cents
  date: string
  description?: string
  company?: string
  workExperienceId?: string
}

export interface EquityEntry {
  grantDate: string
  shares?: number
  percentage?: string
  strikePrice?: number
  currentValue?: number // estimated in cents
  vestingSchedule?: string
  company: string
  workExperienceId?: string
}

// Performance tracking
export interface PerformanceEntry {
  period: string // "2023-Q4", "2023-Annual"
  rating: string // "exceeds", "meets", "below"
  score?: number
  feedback?: string
  goals?: string[]
  company: string
  role: string
  workExperienceId: string
}

// Enhanced certification with relations
export interface CertificationWithRelations extends Certification {
  workExperience?: WorkExperience
}

// Certification summary for dashboard
export interface CertificationSummary {
  totalCertifications: number
  activeCertifications: number
  expiredCertifications: number
  expiringInSixMonths: number

  categories: Array<{
    category: string
    count: number
  }>

  totalInvestment: number // total cost in cents

  upcomingRenewals: Array<{
    id: string
    name: string
    expirationDate: string
    daysUntilExpiration: number
  }>

  certificationsByYear: Array<{
    year: number
    count: number
    totalCost: number
  }>
}
