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
