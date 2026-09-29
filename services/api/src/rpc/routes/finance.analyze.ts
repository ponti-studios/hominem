import { getSpendingTimeSeriesByContract } from '@hominem/finance-services';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  getMonthlyStatsReport,
  getTagBreakdownReport,
  getTopMerchantsReport,
  isUuid,
  toContractFilter,
} from '../../application/finance.service';
import {
  financeMonthlyStatsInputSchema,
  financeTagBreakdownQuerySchema,
  financeTopMerchantsQuerySchema,
} from '../../schemas/finance.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';

const spendingTimeSeriesSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  account: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().optional(),
  groupBy: z.enum(['month', 'week', 'day']).optional(),
  includeStats: z.coerce.boolean().optional(),
  compareToPrevious: z.coerce.boolean().optional(),
});

// Web clients may send a non-UUID sentinel (e.g. "all") for the account filter.
function accountFilter(account?: string) {
  return account && isUuid(account) ? account : undefined;
}

export const analyzeRoutes = new Hono<AppContext>()
  .get(
    '/tag-breakdown',
    authMiddleware,
    zValidator('query', financeTagBreakdownQuerySchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const input = c.req.valid('query');
      return c.json(await getTagBreakdownReport(userId, input));
    },
  )
  .get(
    '/top-merchants',
    authMiddleware,
    zValidator('query', financeTopMerchantsQuerySchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const input = c.req.valid('query');
      return c.json(await getTopMerchantsReport(userId, input));
    },
  )
  .get(
    '/monthly-stats',
    authMiddleware,
    zValidator('query', financeMonthlyStatsInputSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const input = c.req.valid('query');
      return c.json(await getMonthlyStatsReport(userId, input.month));
    },
  )
  .get(
    '/spending-time-series',
    authMiddleware,
    zValidator('query', spendingTimeSeriesSchema),
    async (c) => {
      const userId = c.get('auth')!.userId;
      const input = c.req.valid('query');
      const limit = input.limit ? Math.max(1, Math.floor(input.limit)) : 50;
      const output = await getSpendingTimeSeriesByContract({
        userId,
        ...toContractFilter({
          from: input.from,
          to: input.to,
          accountId: accountFilter(input.account),
          tag: input.tag,
        }),
        limit,
        ...(input.groupBy ? { groupBy: input.groupBy } : {}),
        ...(input.includeStats !== undefined ? { includeStats: input.includeStats } : {}),
      });

      return c.json(output);
    },
  );
