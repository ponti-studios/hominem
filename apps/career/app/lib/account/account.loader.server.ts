import { CareerRepository, db } from '@hominem/db';

import type { CareerPortfolioResponse } from '~/lib/api.server';

import type { AccountLoaderData, AccountPageUser } from './types';

export async function loadAccountPageData({
  user,
  currentPortfolio,
}: {
  user: AccountPageUser;
  currentPortfolio: CareerPortfolioResponse | null;
}): Promise<AccountLoaderData> {
  const socialLinks = await CareerRepository.getUserSocialLinks(db, user.id);

  return {
    user,
    currentPortfolio,
    hasPortfolio: currentPortfolio !== null,
    socialLinks,
  };
}
