import type { CareerFullPortfolioRecord } from '@hominem/db'
import { CareerRepository, getDb } from '@hominem/db'

export interface FullPortfolio extends CareerFullPortfolioRecord {}

export async function getFullUserPortfolio(userId: string): Promise<FullPortfolio | null> {
  return CareerRepository.loadFullPortfolioByUserId(getDb(), userId)
}

export async function getFullPortfolioBySlug(slug: string): Promise<FullPortfolio | null> {
  return CareerRepository.loadFullPortfolioBySlug(getDb(), slug)
}

/**
 * Deletes a user's portfolio and all associated data
 * Due to CASCADE DELETE constraints, this will automatically remove:
 * - socialLinks
 * - portfolioStats
 * - workExperiences
 * - skills
 * - projects
 * - testimonials
 * - analytics
 */
export async function deleteUserPortfolio(userId: string): Promise<void> {
  return CareerRepository.deletePortfolioByUserId(getDb(), userId)
}
