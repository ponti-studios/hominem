import { CareerRepository, db, type CareerPortfolioRecord } from '@hominem/db';

import type { AccountLoaderData, AccountPageUser, AccountPortfolioSummary } from './types';

function toPortfolioSummary(portfolio: CareerPortfolioRecord): AccountPortfolioSummary {
  return {
    id: portfolio.id,
    title: portfolio.title,
    slug: portfolio.slug,
    isPublic: portfolio.isPublic,
    isActive: portfolio.isActive,
    updatedat: portfolio.updatedat,
    name: portfolio.name,
    jobTitle: portfolio.jobTitle,
    bio: portfolio.bio,
    profileImageUrl: portfolio.profileImageUrl || undefined,
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
