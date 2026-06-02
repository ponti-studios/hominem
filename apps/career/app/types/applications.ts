import type { JobApplication } from './career'

export type ApplicationWithCompany = JobApplication & {
  company?: string | { name: string; [key: string]: unknown } | null
  applicationDate?: Date | null
  responseDate?: Date | null
  salaryOffered?: number | null
  source?: string | null
}

export interface JobPosting {
  jobTitle: string
  companyName: string
  companyDescription: string
  jobDescription: string
  location: string
  requirements: string[]
  skills: string[]
  fullText: string
  url: string
  scrapedAt: string
  wordCount: number
}

export interface ScrapedJobPostingResponse {
  success: boolean
  jobPosting?: JobPosting
  error?: string
}
