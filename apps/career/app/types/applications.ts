import type { JobApplicationRecord } from '@hominem/db';

export type ApplicationWithCompany = JobApplicationRecord;

export interface JobPosting {
  job_title: string;
  companyName: string;
  companyDescription: string;
  jobDescription: string;
  location: string;
  salaryRange: string;
  salaryDetails: string;
  employmentType: string;
  experienceLevel: string;
  education: string;
  requirements: string[];
  skills: string[];
  benefits: string[];
  responsibilities: string[];
  industry: string;
  postedDate: string;
  applicationDeadline: string;
  department: string;
  hiringManager: string;
  companySize: string;
  fundingStage: string;
  technologyStack: string[];
  cultureAspects: string[];
  fullText: string;
  url: string;
  scrapedAt: string;
  wordCount: number;
}
