import type { CareerJobApplicationRecord } from '@hominem/db';

export type ApplicationWithCompany = CareerJobApplicationRecord;

export interface JobPosting {
  jobTitle: string;
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
  jobPosting?: JobPosting;
  error?: string;
}
