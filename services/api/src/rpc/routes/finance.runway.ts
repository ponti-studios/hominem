import {
  calculateBudgetBreakdown,
  calculateBudgetBreakdownInputSchema,
  calculateLoanDetails,
  simulateRunway,
  calculateSavingsGoal,
  calculateSavingsGoalInputSchema,
  runwayScenarioInputSchema,
  getRunwaySettings,
  removeRunwayBudget,
  saveRunwayBudget,
  saveRunwayCurrency,
} from '@hominem/finance-services';
import { Hono } from 'hono';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import type { AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

const numberFromQuery = z.coerce.number();

const budgetBreakdownInputSchema = z.object({
  monthlyIncome: numberFromQuery,
  savingsTarget: numberFromQuery.optional(),
});

const savingsGoalInputSchema = z.object({
  currentSavings: numberFromQuery,
  goalAmount: numberFromQuery,
  monthlyContribution: numberFromQuery,
  interestRate: numberFromQuery.optional(),
});

const loanDetailsInputSchema = z.object({
  principal: numberFromQuery,
  annualRate: numberFromQuery,
  months: z.coerce.number().int().positive(),
});

const runwayCurrencySchema = z.object({ currencyCode: z.string().regex(/^[A-Z]{3}$/) });
const runwayBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  currencyCode: z.string().regex(/^[A-Z]{3}$/),
  amount: z.number().finite().nonnegative(),
});
const runwayBudgetDeleteSchema = z.object({ budgetId: z.string().uuid() });

export const runwayRoutes = new Hono<AppContext>()
  .get('/settings', authMiddleware, async (c) =>
    c.json(await getRunwaySettings(c.get('auth')!.userId)),
  )
  .post(
    '/settings/currency',
    authMiddleware,
    zValidator('json', runwayCurrencySchema),
    async (c) => {
      await saveRunwayCurrency(c.get('auth')!.userId, c.req.valid('json').currencyCode);
      return c.json({ success: true });
    },
  )
  .post('/settings/budget', authMiddleware, zValidator('json', runwayBudgetSchema), async (c) => {
    await saveRunwayBudget({ userId: c.get('auth')!.userId, ...c.req.valid('json') });
    return c.json({ success: true });
  })
  .post(
    '/settings/budget/delete',
    authMiddleware,
    zValidator('json', runwayBudgetDeleteSchema),
    async (c) => {
      await removeRunwayBudget(c.get('auth')!.userId, c.req.valid('json').budgetId);
      return c.json({ success: true });
    },
  )
  .post('/calculate', authMiddleware, zValidator('json', runwayScenarioInputSchema), (c) =>
    c.json(simulateRunway(c.req.valid('json'))),
  )
  .get(
    '/budget-breakdown',
    authMiddleware,
    zValidator('query', budgetBreakdownInputSchema),
    async (c) => {
      const input = c.req.valid('query');
      const parsed = calculateBudgetBreakdownInputSchema.parse(input);
      return c.json(calculateBudgetBreakdown(parsed));
    },
  )
  .get('/savings-goal', authMiddleware, zValidator('query', savingsGoalInputSchema), async (c) => {
    const input = c.req.valid('query');
    const parsed = calculateSavingsGoalInputSchema.parse(input);
    return c.json(calculateSavingsGoal(parsed));
  })
  .get('/loan-details', authMiddleware, zValidator('query', loanDetailsInputSchema), async (c) => {
    const input = c.req.valid('query');
    const result = calculateLoanDetails({
      principal: input.principal,
      annualRate: input.annualRate,
      months: input.months,
    });
    return c.json(result);
  });
