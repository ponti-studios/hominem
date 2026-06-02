// Type definitions for better TypeScript support
export type ProjectStatus = 'in-progress' | 'completed' | 'archived'
export type AnalyticsEvent =
  | 'view'
  | 'contact_click'
  | 'project_click'
  | 'skill_click'
  | 'social_click'
  | 'download_resume'
  | 'copy_email'

// Interface definitions for JSON columns
export interface PortfolioTheme {
  primaryColor?: string
  accentColor?: string
  backgroundColor?: string
  fontFamily?: string
}

export interface SalaryRange {
  min: number
  max: number
  currency: string
}

export interface BonusHistoryEntry {
  type: 'annual' | 'signing' | 'performance' | 'retention' | 'spot'
  amount: number // in cents
  date: string
  description?: string
}

export interface WorkExperienceBenefits {
  healthInsurance?: boolean
  dental?: boolean
  vision?: boolean
  retirement401k?: number // percentage match
  retirementVesting?: string // vesting schedule
  paidTimeOff?: number // days per year
  sickLeave?: number // days per year
  parentalLeave?: number // weeks
  stockOptions?: boolean
  stockPurchasePlan?: boolean
  flexibleSchedule?: boolean
  remoteWork?: boolean
  gymMembership?: boolean
  tuitionReimbursement?: number // annual amount in cents
  professionalDevelopment?: number // annual budget in cents
  commuter?: number // monthly allowance in cents
  meals?: string // "free", "subsidized", "none"
  other?: string[]
}

export interface PerformanceRating {
  period: string // "2023-Q4", "2023-Annual"
  rating: string // "exceeds", "meets", "below"
  score?: number // if numeric scale
  feedback?: string
  goals?: string[]
}

// Salary adjustment tracking
export interface SalaryAdjustment {
  effectiveDate: string
  previousSalary: number
  newSalary: number
  increaseAmount: number
  increasePercentage: number
  reason: 'promotion' | 'merit_increase' | 'market_adjustment' | 'cost_of_living' | 'role_change'
  newTitle?: string
  notes?: string
  company: string
  workExperienceId: string
}

export interface WorkExperienceMetadata {
  company_size?: string
  industry?: string
  location?: string
  website?: string
  achievements?: string[]
  technologies?: string[]
}

export interface InterviewEntry {
  type: 'phone' | 'video' | 'onsite' | 'technical' | 'final'
  date: string
  duration?: number
  interviewer?: string
  notes?: string
}

export interface ApplicationStage {
  stage: string
  date: string
  notes?: string
}

export interface MarketSalaryRange {
  min: number
  max: number
  median: number
  source: string // "glassdoor", "levels.fyi", "salary.com"
  date: string
}

export interface CareerGoals {
  shortTerm?: string[]
  longTerm?: string[]
  skillsToAcquire?: string[]
  targetRole?: string
  targetSalary?: number
}
