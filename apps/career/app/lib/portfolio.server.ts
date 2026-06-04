import type { CareerFullPortfolioRecord } from '@hominem/db';
import { CareerRepository, getDb } from '@hominem/db';

export interface FullPortfolio extends CareerFullPortfolioRecord {}

export async function getFullUserPortfolio(owner_userid: string): Promise<FullPortfolio | null> {
  return CareerRepository.loadFullPortfolioByUserId(getDb(), owner_userid);
}

export async function getFullPortfolioBySlug(slug: string): Promise<FullPortfolio | null> {
  return CareerRepository.loadFullPortfolioBySlug(getDb(), slug);
}

/**
 * Deletes a user's portfolio and all associated data
 * Due to CASCADE DELETE constraints, this will automatically remove:
 * - social_links
 * - portfolio_stats
 * - work_experiences
 * - skills
 * - projects
 * - testimonials
 * - analytics
 */
export async function deleteUserPortfolio(owner_userid: string): Promise<void> {
  return CareerRepository.deletePortfolioByUserId(getDb(), owner_userid);
}
