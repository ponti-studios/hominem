import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

import { CalendarService } from '../../application/calendar.service';
import { FinanceService } from '../../application/finance.service';
import {
  calendarOccurrenceSchema,
  calendarSearchQuerySchema,
  calendarUpcomingQuerySchema,
} from '../../schemas/calendar.schema';
import {
  financeMonthlySummaryQuerySchema,
  financeMonthlySummarySchema,
} from '../../schemas/finance.schema';
import { authMiddleware, type AppContext } from '../middleware/auth';
import { respondWithData } from '../response';

const routes = new Hono<AppContext>();
const calendarOccurrencesSchema = calendarOccurrenceSchema.array();
const calendarService = new CalendarService();
const financeService = new FinanceService();

routes
  .get(
    '/calendar/search',
    authMiddleware,
    zValidator('query', calendarSearchQuerySchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const results = await calendarService.search(userId, input);
      return respondWithData(c, calendarOccurrencesSchema, results);
    },
  )
  .get(
    '/calendar/upcoming',
    authMiddleware,
    zValidator('query', calendarUpcomingQuerySchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const results = await calendarService.upcoming(userId, input);
      return respondWithData(c, calendarOccurrencesSchema, results);
    },
  )
  .get(
    '/finance/monthly-summary',
    authMiddleware,
    zValidator('query', financeMonthlySummaryQuerySchema),
    async (c) => {
      const userId = c.get('userId')!;
      const input = c.req.valid('query');
      const summary = await financeService.monthlySummary(userId, input);
      return respondWithData(c, financeMonthlySummarySchema, summary);
    },
  );

export const personalRoutes: Hono<AppContext> = routes;
