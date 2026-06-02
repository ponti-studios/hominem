import type {
  CareerCompanyRecord as Company,
  CareerJobApplicationRecord as JobApplication,
  CareerWorkExperienceRecord as WorkExperience,
} from '@hominem/db';
import { CareerRepository, getDb } from '@hominem/db';

export async function getUserWorkExperiences(userId: string) {
  return CareerRepository.listUserWorkExperiences(getDb(), userId, 'asc');
}

export async function getUserWorkExperiencesDesc(userId: string) {
  return CareerRepository.listUserWorkExperiences(getDb(), userId, 'desc');
}

export async function getUserCareerEvents(userId: string, limit?: number) {
  return CareerRepository.listUserCareerEvents(getDb(), userId, limit);
}

export async function getUserJobApplications(userId: string) {
  return CareerRepository.listUserJobApplicationsWithCompany(getDb(), userId);
}

export async function getCurrentWorkExperience(userId: string) {
  const experiences = await getUserWorkExperiencesDesc(userId);
  return experiences.find((experience) => !experience.endDate) || experiences[0] || null;
}

export async function getFirstWorkExperience(userId: string) {
  const experiences = await getUserWorkExperiences(userId);
  return experiences[0] || null;
}

export async function getWorkExperiencesByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
) {
  const experiences = await getUserWorkExperiences(userId);
  return experiences.filter((experience) => {
    if (!experience.startDate) {
      return false;
    }

    const experienceStartDate = new Date(experience.startDate);
    return experienceStartDate >= startDate && experienceStartDate <= endDate;
  });
}

export async function getCareerEventsByType(userId: string, eventType: string) {
  const events = await getUserCareerEvents(userId);
  return events.filter((event) => event.eventType === eventType);
}

export async function getJobApplicationsByStatus(userId: string, status: string) {
  const applications = await getUserJobApplications(userId);
  return applications.filter((application) => application.status === status);
}

export async function getUserCompanies(userId: string) {
  const experiences = await getUserWorkExperiences(userId);
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

export async function getWorkExperienceById(userId: string, experienceId: string) {
  return CareerRepository.getWorkExperienceById(getDb(), userId, experienceId);
}

export async function updateWorkExperience(
  userId: string,
  experienceId: string,
  updates: Partial<WorkExperience>,
) {
  return CareerRepository.updateWorkExperience(getDb(), userId, experienceId, updates);
}
