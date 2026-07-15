import type {
  FullPortfolioRecord,
  PortfolioRecord,
  PublicPortfolioProfileRecord,
  ResumePortfolioRecord,
} from '@hominem/db';
import { db, PortfolioRepository } from '@hominem/db';

import { fetchCurrentPortfolio } from './api.server';
import type { User } from './auth.server';

export interface FullPortfolio extends FullPortfolioRecord {}
export interface ResumePortfolio extends ResumePortfolioRecord {}
export interface PublicPortfolioProfile extends PublicPortfolioProfileRecord {}

/** Full record including testimonials — for the generic portfolio JSON API, which returns everything to the caller. */
export async function getFullUserPortfolio(owner_userid: string): Promise<FullPortfolio | null> {
  return PortfolioRepository.loadFullPortfolioByUserId(db, owner_userid);
}

/** Work experiences, skills, and projects only — for LLM prompt context, which never reads testimonials. */
export async function getResumePortfolioContext(
  owner_userid: string,
): Promise<ResumePortfolio | null> {
  return PortfolioRepository.loadResumeContextByUserId(db, owner_userid);
}

/** Work experiences, skills, and projects only — for the public profile page, which doesn't render testimonials. */
export async function getPublicPortfolioProfile(
  slug: string,
): Promise<PublicPortfolioProfile | null> {
  return PortfolioRepository.loadPublicProfileBySlug(db, slug);
}

function portfolioDisplayName(user: { name?: string | null; email?: string | null }): string {
  const name = user.name?.trim();
  if (name) return name;
  const local = user.email?.split('@')[0]?.trim();
  return local || 'You';
}

/**
 * Every signed-in career user gets exactly one portfolio.
 * Creates a private empty shell on first access if missing.
 */
export async function ensureUserPortfolio(request: Request, user: User): Promise<PortfolioRecord> {
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
