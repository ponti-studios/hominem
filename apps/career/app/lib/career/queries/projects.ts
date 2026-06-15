import type { CareerProjectRecord } from '@hominem/db';
import { CareerRepository, db } from '@hominem/db';

export async function getProjectsByPortfolio(portfolio_id: string) {
  return CareerRepository.listProjectsByPortfolio(db, portfolio_id);
}

export async function getProjectById(owner_userid: string, projectId: string) {
  return CareerRepository.getProjectById(db, owner_userid, projectId);
}

export async function getProjectsByWorkExperience(
  portfolio_id: string,
  work_experience_id: string,
) {
  return CareerRepository.listProjectsByWorkExperience(db, portfolio_id, work_experience_id);
}

export async function createProject(
  owner_userid: string,
  projectData: {
    portfolio_id: string;
    work_experience_id?: string | null;
    title: string;
    description: string;
    short_description?: string | null;
    status: string;
    technologies?: string[];
    is_visible: boolean;
    is_featured: boolean;
    sort_order: number;
  },
): Promise<CareerProjectRecord> {
  return CareerRepository.createProject(db, owner_userid, projectData);
}

export async function updateProject(
  owner_userid: string,
  projectId: string,
  portfolio_id: string,
  updates: {
    work_experience_id?: string | null;
    title: string;
    description: string;
    short_description?: string | null;
    status: string;
    technologies?: string[];
    is_visible?: boolean;
    is_featured?: boolean;
    sort_order?: number;
  },
) {
  await CareerRepository.updateProject(db, owner_userid, projectId, portfolio_id, updates);
}

export async function deleteProject(owner_userid: string, projectId: string, portfolio_id: string) {
  await CareerRepository.deleteProject(db, owner_userid, projectId, portfolio_id);
}
