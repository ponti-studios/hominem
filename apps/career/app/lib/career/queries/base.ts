import type {
  CompanyRecord as Company,
  JobApplicationRecord as JobApplication,
  UpdateWorkExperienceInput,
} from '@hominem/db';
import { db, JobApplicationRepository, WorkExperienceRepository } from '@hominem/db';

export async function getUserWorkExperiencesDesc(ownerUserid: string) {
  return WorkExperienceRepository.listUserWorkExperiences(db, ownerUserid, 'desc');
}

export async function getUserJobApplications(ownerUserid: string) {
  return JobApplicationRepository.listUserJobApplicationsWithCompany(db, ownerUserid);
}

type JobApplicationWithCompany = JobApplication & {
  company: Company | null;
};

export function extractJobApplications(joinedResults: JobApplicationWithCompany[]) {
  return joinedResults;
}

export async function getWorkExperienceById(ownerUserid: string, experienceId: string) {
  return WorkExperienceRepository.getWorkExperienceById(db, ownerUserid, experienceId);
}

export async function updateWorkExperience(
  ownerUserid: string,
  experienceId: string,
  updates: UpdateWorkExperienceInput,
) {
  return WorkExperienceRepository.updateWorkExperience(db, {
    ownerUserid,
    experienceId,
    updates,
  });
}
