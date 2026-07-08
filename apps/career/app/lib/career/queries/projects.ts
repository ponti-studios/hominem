import type { CareerProjectRecord } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';

export async function getProjectsByPortfolio(portfolioId: string) {
  return CareerRepository.listProjectsByPortfolio(db, portfolioId);
}

export async function getProjectById(ownerUserid: string, projectId: string) {
  return CareerRepository.getProjectById(db, ownerUserid, projectId);
}

export async function getProjectsByWorkExperience(portfolioId: string, workExperienceId: string) {
  return CareerRepository.listProjectsByWorkExperience(db, portfolioId, workExperienceId);
}

export async function createProject(
  ownerUserid: string,
  projectData: {
    portfolioId: string;
    workExperienceId?: string | null;
    title: string;
    description: string;
    shortDescription?: string | null;
    status: string;
    technologies?: string[];
    isVisible: boolean;
    isFeatured: boolean;
    sortOrder: number;
  },
): Promise<CareerProjectRecord> {
  return CareerRepository.createProject(db, ownerUserid, projectData);
}

export async function updateProject(
  ownerUserid: string,
  projectId: string,
  portfolioId: string,
  updates: {
    workExperienceId?: string | null;
    title: string;
    description: string;
    shortDescription?: string | null;
    status: string;
    technologies?: string[];
    isVisible?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
  },
) {
  await CareerRepository.updateProject(db, ownerUserid, projectId, portfolioId, updates);
}

export async function deleteProject(ownerUserid: string, projectId: string, portfolioId: string) {
  await CareerRepository.deleteProject(db, ownerUserid, projectId, portfolioId);
}
