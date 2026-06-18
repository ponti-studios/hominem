import { CareerRepository, db, type CareerPortfolioRecord } from '@hominem/db';

import type { AccountLoaderData, AccountPageUser, AccountPortfolioSummary } from './types';

function toPortfolioSummary(portfolio: CareerPortfolioRecord): AccountPortfolioSummary {
  return {
    id: portfolio.id,
    title: portfolio.title,
    slug: portfolio.slug,
    is_public: portfolio.is_public,
    is_active: portfolio.is_active,
    updatedat: portfolio.updatedat,
    name: portfolio.name,
    job_title: portfolio.job_title,
    bio: portfolio.bio,
    profile_image_url: portfolio.profile_image_url || undefined,
  };
}

export async function loadAccountPageData({
  user,
  currentPortfolio,
}: {
  user: AccountPageUser;
  currentPortfolio: CareerPortfolioRecord | null;
}): Promise<AccountLoaderData> {
  const portfolioRows = await CareerRepository.listPortfoliosByUserId(db, user.id);
  const portfolios = portfolioRows.map(toPortfolioSummary);

  return {
    user,
    portfolios,
    currentPortfolio,
    currentPortfolioId: currentPortfolio?.id ?? null,
    hasPortfolio: portfolios.length > 0,
  };
}
