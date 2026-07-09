import type { ProjectRecord } from '@hominem/db';
import { db, ProjectRepository } from '@hominem/db';

export async function getProjectsByPortfolio(portfolioId: string) {
  return ProjectRepository.listProjectsByPortfolio(db, portfolioId);
}

export async function getProjectById(ownerUserid: string, projectId: string) {
  return ProjectRepository.getProjectById(db, ownerUserid, projectId);
}

export async function getProjectsByWorkExperience(portfolioId: string, workExperienceId: string) {
  return ProjectRepository.listProjectsByWorkExperience(db, portfolioId, workExperienceId);
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
): Promise<ProjectRecord> {
  return ProjectRepository.createProject(db, ownerUserid, projectData);
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
  await ProjectRepository.updateProject(db, ownerUserid, projectId, portfolioId, updates);
}

export async function deleteProject(ownerUserid: string, projectId: string, portfolioId: string) {
  await ProjectRepository.deleteProject(db, ownerUserid, projectId, portfolioId);
}
