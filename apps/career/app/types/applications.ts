import type { CareerJobApplicationRecord } from '@hominem/db';

export type ApplicationWithCompany = CareerJobApplicationRecord;

export interface JobPosting {
  job_title: string;
  companyName: string;
  companyDescription: string;
  jobDescription: string;
  location: string;
  requirements: string[];
  skills: string[];
  fullText: string;
  url: string;
  scrapedAt: string;
  wordCount: number;
}

export interface ScrapedJobPostingResponse {
  success: boolean;
  job_posting?: JobPosting;
  error?: string;
}
