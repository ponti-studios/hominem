import type { CareerProjectRecord } from '@hominem/db'
import { CareerRepository, getDb } from '@hominem/db'

export async function getProjectsByPortfolio(portfolioId: string) {
  return CareerRepository.listProjectsByPortfolio(getDb(), portfolioId)
}

export async function getProjectsByWorkExperience(portfolioId: string, workExperienceId: string) {
  return CareerRepository.listProjectsByWorkExperience(getDb(), portfolioId, workExperienceId)
}

export async function createProject(
  userId: string,
  projectData: {
    portfolioId: string
    workExperienceId?: string | null
    title: string
    description: string
    shortDescription?: string | null
    status: string
    technologies?: string[]
    isVisible: boolean
    isFeatured: boolean
    sortOrder: number
  }
): Promise<CareerProjectRecord> {
  return CareerRepository.createProject(getDb(), userId, projectData)
}

export async function updateProject(
  userId: string,
  projectId: string,
  portfolioId: string,
  updates: {
    workExperienceId?: string | null
    title: string
    description: string
    shortDescription?: string | null
    status: string
    technologies?: string[]
    isVisible?: boolean
    isFeatured?: boolean
    sortOrder?: number
  }
) {
  await CareerRepository.updateProject(getDb(), userId, projectId, portfolioId, updates)
}

export async function deleteProject(userId: string, projectId: string, portfolioId: string) {
  await CareerRepository.deleteProject(getDb(), userId, projectId, portfolioId)
}
