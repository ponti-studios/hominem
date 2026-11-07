import { Hono } from 'hono';

import { getPublicCareerPortfolio } from '../../application/career.service';
import { careerPortfolioOutputSchema } from '../../schemas/career.schema';
import { NotFoundError } from '../errors';
import type { AppContext } from '../middleware/auth';

// Public by design: a profile is only returned when `is_public` is true, and a
// slug is the shareable identity for the portfolio (docs/web.sub-apps.md, D2).
export const careerPortfolioRoutes = new Hono<AppContext>().get('/:slug', async (c) => {
  const portfolio = await getPublicCareerPortfolio(c.req.param('slug'));
  if (!portfolio) {
    throw new NotFoundError('Profile');
  }
  return c.json(careerPortfolioOutputSchema.parse(portfolio));
});
