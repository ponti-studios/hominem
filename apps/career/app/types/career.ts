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
  stage: JobApplicationStage;
  date: string;
  notes?: string;
}

export interface JobApplication {
  id: string;
  owner_userid: string;
  position: string;
  company_id: string;
  company?: string;
  status: JobApplicationStatus;
  start_date: Date;
  end_date?: Date | null;
  location?: string;
  job_posting?: string;
  salary_quoted?: string;
  salary_accepted?: string | null;
  cover_letter?: string | null;
  resume?: string | null;
  jobId?: string | null;
  link?: string | null;
  phone_screen?: string | null;
  reference: boolean;
  stages: JobApplicationStageEntry[];
  // Recruiter Information
  recruiter_name?: string | null;
  recruiter_email?: string | null;
  recruiter_linkedin?: string | null;
  createdat?: Date;
  updatedat?: Date;
}

export interface JobApplicationInsert {
  owner_userid: string;
  position: string;
  company_id: string;
  status: JobApplicationStatus;
  start_date?: Date;
  end_date?: Date | null;
  location?: string;
  job_posting?: string;
  salary_quoted?: string;
  salary_accepted?: string | null;
  cover_letter?: string | null;
  resume?: string | null;
  jobId?: string | null;
  link?: string | null;
  phone_screen?: string | null;
  reference: boolean;
  stages: JobApplicationStageEntry[];
  // Recruiter Information
  recruiter_name?: string | null;
  recruiter_email?: string | null;
  recruiter_linkedin?: string | null;
}

export interface Company {
  id: string;
  name: string;
  website?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  createdat?: Date;
  updatedat?: Date;
}
