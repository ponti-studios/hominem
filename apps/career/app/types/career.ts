export enum JobApplicationStatus {
  APPLIED = 'APPLIED',
  PHONE_SCREEN = 'PHONE_SCREEN',
  INTERVIEW = 'INTERVIEW',
  FINAL_INTERVIEW = 'FINAL_INTERVIEW',
  OFFER = 'OFFER',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum JobApplicationStage {
  APPLICATION = 'APPLICATION',
  PHONE_SCREEN = 'PHONE_SCREEN',
  FIRST_INTERVIEW = 'FIRST_INTERVIEW',
  SECOND_INTERVIEW = 'SECOND_INTERVIEW',
  FINAL_INTERVIEW = 'FINAL_INTERVIEW',
  TECHNICAL_INTERVIEW = 'TECHNICAL_INTERVIEW',
  OFFER = 'OFFER',
  BACKGROUND_CHECK = 'BACKGROUND_CHECK',
  REFERENCE_CHECK = 'REFERENCE_CHECK',
}

export interface JobApplicationStageEntry {
  stage: JobApplicationStage
  date: string
  notes?: string
}

export interface JobApplication {
  id: string
  userId: string
  position: string
  companyId: string
  company?: string
  status: JobApplicationStatus
  startDate: Date
  endDate?: Date | null
  location?: string
  jobPosting?: string
  salaryQuoted?: string
  salaryAccepted?: string | null
  coverLetter?: string | null
  resume?: string | null
  jobId?: string | null
  link?: string | null
  phoneScreen?: string | null
  reference: boolean
  stages: JobApplicationStageEntry[]
  // Recruiter Information
  recruiterName?: string | null
  recruiterEmail?: string | null
  recruiterLinkedin?: string | null
  createdAt?: Date
  updatedAt?: Date
}

export interface JobApplicationInsert {
  userId: string
  position: string
  companyId: string
  status: JobApplicationStatus
  startDate?: Date
  endDate?: Date | null
  location?: string
  jobPosting?: string
  salaryQuoted?: string
  salaryAccepted?: string | null
  coverLetter?: string | null
  resume?: string | null
  jobId?: string | null
  link?: string | null
  phoneScreen?: string | null
  reference: boolean
  stages: JobApplicationStageEntry[]
  // Recruiter Information
  recruiterName?: string | null
  recruiterEmail?: string | null
  recruiterLinkedin?: string | null
}

export interface Company {
  id: string
  name: string
  website?: string
  industry?: string
  size?: string
  location?: string
  description?: string
  createdAt?: Date
  updatedAt?: Date
}
