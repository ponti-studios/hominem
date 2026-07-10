import {
  CalendarQueryRepository,
  FinanceQueryRepository,
  ImportHealthRepository,
} from '@hominem/db';
import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import {
  calendarOccurrenceSchema,
  calendarSearchQuerySchema,
  calendarUpcomingQuerySchema,
  financeMonthlySummaryQuerySchema,
  financeMonthlySummarySchema,
  personalDataHealthSchema,
} from '../../schemas/personal-data.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';

const routes = new Hono<AppContext>();

routes
  .get(
    '/calendar/search',
    authMiddleware,
    zValidator('query', calendarSearchQuerySchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const results = await CalendarQueryRepository.search(userId, input);
      return c.json({ data: calendarOccurrenceSchema.array().parse(results) }, 200);
    },
  )
  .get(
    '/calendar/upcoming',
    authMiddleware,
    zValidator('query', calendarUpcomingQuerySchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const results = await CalendarQueryRepository.upcoming(userId, input);
      return c.json({ data: calendarOccurrenceSchema.array().parse(results) }, 200);
    },
  )
  .get(
    '/finance/monthly-summary',
    authMiddleware,
    zValidator('query', financeMonthlySummaryQuerySchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const summary = await FinanceQueryRepository.monthlySummary(userId, input);
      return c.json({ data: financeMonthlySummarySchema.parse(summary) }, 200);
    },
  )
  .get('/data-health', authMiddleware, async (c) => {
    const userId = c.get('userId')!;
    const health = await ImportHealthRepository.getPersonalDataHealth(userId);
    return c.json({ data: personalDataHealthSchema.parse(health) }, 200);
  });

export const personalRoutes: Hono<AppContext> = routes;
