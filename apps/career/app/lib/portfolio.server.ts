import type { FullPortfolioRecord } from '@hominem/db';
import { db, PortfolioRepository } from '@hominem/db';

export interface FullPortfolio extends FullPortfolioRecord {}

export async function getFullUserPortfolio(owner_userid: string): Promise<FullPortfolio | null> {
  return PortfolioRepository.loadFullPortfolioByUserId(db, owner_userid);
}

export async function getFullPortfolioBySlug(slug: string): Promise<FullPortfolio | null> {
  return PortfolioRepository.loadFullPortfolioBySlug(db, slug);
}

/**
 * Deletes a user's portfolio and all associated data
 * Due to CASCADE DELETE constraints, this will automatically remove:
 * - work_experiences
 * - skills
 * - projects
 * - testimonials
 * - analytics
 *
 * Social links are user-scoped (app.user_social_links), not portfolio-scoped,
 * so they are unaffected by portfolio deletion.
 */
export async function deleteUserPortfolio(owner_userid: string): Promise<void> {
  return PortfolioRepository.deletePortfolioByUserId(db, owner_userid);
}
