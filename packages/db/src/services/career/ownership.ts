import { NotFoundError } from '../../errors';
import type { DbHandle } from '../../transaction';

/**
 * Throws NotFoundError unless the portfolio exists and is owned by ownerUserid.
 * Shared by every child-entity repository (work experiences, projects,
 * testimonials, skills) so they don't each duplicate the same ownership
 * query, and so portfolio.repository.ts doesn't need to import them back
 * (which would create a circular dependency).
 */
export async function verifyPortfolioOwnership(
  handle: DbHandle,
  ownerUserid: string,
  portfolioId: string,
): Promise<void> {
  const row = await handle
    .selectFrom('app.portfolios')
    .select('id')
    .where('id', '=', portfolioId)
    .where('ownerUserid', '=', ownerUserid)
    .executeTakeFirst();

  if (!row) {
    throw new NotFoundError('Portfolio', { portfolioId, ownerUserid });
  }
}
