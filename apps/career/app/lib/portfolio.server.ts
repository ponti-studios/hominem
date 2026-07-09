import type { FullPortfolioRecord, PortfolioRecord } from '@hominem/db';
import { db, PortfolioRepository } from '@hominem/db';

import type { User } from './auth.server';
import { fetchCurrentPortfolio } from './api.server';

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

export function portfolioDisplayName(user: {
  name?: string | null;
  email?: string | null;
}): string {
  const name = user.name?.trim();
  if (name) return name;
  const local = user.email?.split('@')[0]?.trim();
  return local || 'You';
}

/**
 * Every signed-in career user gets exactly one portfolio.
 * Creates a private empty shell on first access if missing.
 */
export async function ensureUserPortfolio(
  request: Request,
  user: User,
): Promise<PortfolioRecord> {
  const existing = await fetchCurrentPortfolio(request);
  if (existing) return existing;

  try {
    return await PortfolioRepository.createDefaultPortfolio(db, {
      ownerUserid: user.id,
      email: user.email ?? '',
      name: portfolioDisplayName(user),
    });
  } catch {
    // Concurrent first request may have created it; re-fetch.
    const raced = await fetchCurrentPortfolio(request);
    if (raced) return raced;
    throw new Error('Could not create portfolio for user');
  }
}
