import type {
  CompanyRecord as Company,
  JobApplicationRecord as JobApplication,
  UpdateWorkExperienceInput,
  WorkExperienceRecord as WorkExperience,
} from '@hominem/db';
import {
  CareerEventRepository,
  db,
  JobApplicationRepository,
  WorkExperienceRepository,
} from '@hominem/db';

export async function getUserWorkExperiences(ownerUserid: string) {
  return WorkExperienceRepository.listUserWorkExperiences(db, ownerUserid, 'desc');
}

export async function getUserWorkExperiencesDesc(ownerUserid: string) {
  return WorkExperienceRepository.listUserWorkExperiences(db, ownerUserid, 'desc');
}

export async function getUserCareerEvents(ownerUserid: string, limit?: number) {
  return CareerEventRepository.listUserCareerEvents(db, ownerUserid, limit);
}

export async function getUserJobApplications(ownerUserid: string) {
  return JobApplicationRepository.listUserJobApplicationsWithCompany(db, ownerUserid);
}

export async function getCurrentWorkExperience(ownerUserid: string) {
  const experiences = await getUserWorkExperiencesDesc(ownerUserid);
  return experiences.find((experience) => !experience.endDate) || experiences[0] || null;
}

export async function getFirstWorkExperience(ownerUserid: string) {
  const experiences = await WorkExperienceRepository.listUserWorkExperiences(
    db,
    ownerUserid,
    'asc',
  );
  return experiences[0] || null;
}

export async function getWorkExperiencesByDateRange(
  ownerUserid: string,
  startDate: Date,
  endDate: Date,
) {
  const experiences = await getUserWorkExperiences(ownerUserid);
  return experiences.filter((experience) => {
    if (!experience.startDate) {
      return false;
    }

    const experienceStartDate = new Date(experience.startDate);
    return experienceStartDate >= startDate && experienceStartDate <= endDate;
  });
}

export async function getCareerEventsByType(ownerUserid: string, eventType: string) {
  const events = await getUserCareerEvents(ownerUserid);
  return events.filter((event) => event.eventType === eventType);
}

export async function getJobApplicationsByStatus(ownerUserid: string, status: string) {
  const applications = await getUserJobApplications(ownerUserid);
  return applications.filter((application) => application.status === status);
}

export async function getUserCompanies(ownerUserid: string) {
  const experiences = await getUserWorkExperiences(ownerUserid);
  return [...new Set(experiences.map((experience) => experience.company))];
}

export function extractWorkExperiences(joinedResults: WorkExperience[]) {
  return joinedResults;
}

export type JobApplicationWithCompany = JobApplication & {
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
  return WorkExperienceRepository.updateWorkExperience(db, ownerUserid, experienceId, updates);
}
