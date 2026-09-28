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
import { authMiddleware, type AppContext } from '../middleware/auth';

const tagBreakdownSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  account: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().optional(),
});

const topMerchantsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  account: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().optional(),
});

const monthlyStatsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});

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
  .get('/tag-breakdown', authMiddleware, zValidator('query', tagBreakdownSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('query');
    return c.json(
      await getTagBreakdownReport(userId, {
        from: input.from,
        to: input.to,
        accountId: accountFilter(input.account),
        tag: input.tag,
        limit: input.limit ?? 5,
      }),
    );
  })
  .get('/top-merchants', authMiddleware, zValidator('query', topMerchantsSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('query');
    return c.json(
      await getTopMerchantsReport(userId, {
        from: input.from,
        to: input.to,
        accountId: accountFilter(input.account),
        tag: input.tag,
        limit: input.limit,
      }),
    );
  })
  .get('/monthly-stats', authMiddleware, zValidator('query', monthlyStatsSchema), async (c) => {
    const userId = c.get('auth')!.userId;
    const input = c.req.valid('query');
    return c.json(await getMonthlyStatsReport(userId, input.month));
  })
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
