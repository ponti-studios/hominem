import type {
  CareerCompanyRecord as Company,
  CareerJobApplicationRecord as JobApplication,
  CareerWorkExperienceRecord as WorkExperience,
  UpdateCareerWorkExperienceInput,
} from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';

export async function getUserWorkExperiences(owner_userid: string) {
  return CareerRepository.listUserWorkExperiences(db, owner_userid, 'asc');
}

export async function getUserWorkExperiencesDesc(owner_userid: string) {
  return CareerRepository.listUserWorkExperiences(db, owner_userid, 'desc');
}

export async function getUserCareerEvents(owner_userid: string, limit?: number) {
  return CareerRepository.listUserCareerEvents(db, owner_userid, limit);
}

export async function getUserJobApplications(owner_userid: string) {
  return CareerRepository.listUserJobApplicationsWithCompany(db, owner_userid);
}

export async function getCurrentWorkExperience(owner_userid: string) {
  const experiences = await getUserWorkExperiencesDesc(owner_userid);
  return experiences.find((experience) => !experience.end_date) || experiences[0] || null;
}

export async function getFirstWorkExperience(owner_userid: string) {
  const experiences = await getUserWorkExperiences(owner_userid);
  return experiences[0] || null;
}

export async function getWorkExperiencesByDateRange(
  owner_userid: string,
  start_date: Date,
  end_date: Date,
) {
  const experiences = await getUserWorkExperiences(owner_userid);
  return experiences.filter((experience) => {
    if (!experience.start_date) {
      return false;
    }

    const experienceStartDate = new Date(experience.start_date);
    return experienceStartDate >= start_date && experienceStartDate <= end_date;
  });
}

export async function getCareerEventsByType(owner_userid: string, event_type: string) {
  const events = await getUserCareerEvents(owner_userid);
  return events.filter((event) => event.event_type === event_type);
}

export async function getJobApplicationsByStatus(owner_userid: string, status: string) {
  const applications = await getUserJobApplications(owner_userid);
  return applications.filter((application) => application.status === status);
}

export async function getUserCompanies(owner_userid: string) {
  const experiences = await getUserWorkExperiences(owner_userid);
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

export async function getWorkExperienceById(owner_userid: string, experienceId: string) {
  return CareerRepository.getWorkExperienceById(db, owner_userid, experienceId);
}

export async function updateWorkExperience(
  owner_userid: string,
  experienceId: string,
  updates: UpdateCareerWorkExperienceInput,
) {
  return CareerRepository.updateWorkExperience(db, owner_userid, experienceId, updates);
}
