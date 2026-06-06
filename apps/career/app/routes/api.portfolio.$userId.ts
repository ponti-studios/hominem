import { data, type LoaderFunctionArgs } from 'react-router';

import { logger } from '../lib/logger';
import { getFullUserPortfolio } from '../lib/portfolio.server';

export async function loader({ params }: LoaderFunctionArgs) {
  const { owner_userid } = params;

  if (!owner_userid) {
    return data({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const portfolio = await getFullUserPortfolio(owner_userid);

    if (!portfolio) {
      return data({ error: 'Portfolio not found' }, { status: 404 });
    }

    return portfolio;
  } catch (error) {
    logger.error(
      'Error fetching portfolio',
      error instanceof Error ? error : undefined,
      error instanceof Error ? { owner_userid } : { owner_userid, error },
    );
    return data({ error: 'Internal server error' }, { status: 500 });
  }
}
