import { db, SocialLinksRepository } from '@hominem/db';
import type { PortfolioRecord } from '@hominem/db';

import { listUserDocuments } from './documents.server';
import type { AccountLoaderData, AccountPageUser } from './types';

export async function loadAccountPageData({
  user,
  currentPortfolio,
}: {
  user: AccountPageUser;
  currentPortfolio: PortfolioRecord;
}): Promise<AccountLoaderData> {
  const [socialLinks, documents] = await Promise.all([
    SocialLinksRepository.get(db, user.id),
    listUserDocuments(user.id),
  ]);

  return {
    user,
    currentPortfolio,
    hasPortfolio: true,
    socialLinks,
    documents,
  };
}
