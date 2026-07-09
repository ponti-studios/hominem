import { db, SocialLinksRepository } from '@hominem/db';
import type { PortfolioRecord } from '@hominem/db';

import type { AccountLoaderData, AccountPageUser } from './types';

export async function loadAccountPageData({
  user,
  currentPortfolio,
}: {
  user: AccountPageUser;
  currentPortfolio: PortfolioRecord;
}): Promise<AccountLoaderData> {
  const socialLinks = await SocialLinksRepository.get(db, user.id);

  return {
    user,
    currentPortfolio,
    hasPortfolio: true,
    socialLinks,
  };
}
