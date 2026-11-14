import { calculateAffordability, getAffordabilityContext } from '@hominem/finance-services';
import { Hono } from 'hono';
import { z } from 'zod';

import { ValidationError } from '../../errors';
import { authMiddleware } from '../middleware/auth';
import type { AppContext } from '../middleware/auth';
import { zValidator } from '../validator';

const affordabilityInputSchema = z.object({
  purchaseAmount: z.number().finite().positive(),
  monthlyIncomeOverride: z.number().finite().nonnegative().optional(),
  monthlyExpensesOverride: z.number().finite().nonnegative().optional(),
  cashBalanceOverride: z.number().finite().optional(),
  reserveTarget: z.number().finite().nonnegative().nullable().optional(),
});

export const affordabilityRoutes = new Hono<AppContext>()
  .post('/check', authMiddleware, zValidator('json', affordabilityInputSchema), async (c) => {
    const input = c.req.valid('json');
    const context = await getAffordabilityContext(c.get('auth')!.userId);
    if (!context.currencyCode) {
      throw new ValidationError('Choose a Finance currency before checking this purchase.');
    }

    if (context.startingCash !== null && input.cashBalanceOverride !== undefined) {
      throw new ValidationError(
        'A manual cash balance is only allowed when Finance has no balance.',
      );
    }
    const currentBalance = input.cashBalanceOverride ?? context.startingCash;
    if (currentBalance === null) {
      throw new ValidationError('Enter a temporary cash balance to continue.');
    }
    const monthlyIncome = input.monthlyIncomeOverride ?? context.monthlyIncome;
    const monthlyExpenses = input.monthlyExpensesOverride ?? context.monthlyExpenses;
    if (monthlyIncome === null || monthlyExpenses === null) {
      throw new ValidationError('Enter monthly income and expenses to continue.');
    }
    const reserveTarget =
      input.reserveTarget === undefined ? monthlyExpenses * 3 : input.reserveTarget;

    return c.json({
      ...calculateAffordability({
        currencyCode: context.currencyCode,
        purchaseAmount: input.purchaseAmount,
        currentBalance,
        monthlyIncome,
        monthlyExpenses,
        reserveTarget,
      }),
      historyStartDate: context.historyStartDate,
      historyEndDate: context.historyEndDate,
      balanceSource: input.cashBalanceOverride === undefined ? 'finance' : 'manual',
      monthlyIncomeSource: input.monthlyIncomeOverride === undefined ? 'finance' : 'manual',
      monthlyExpensesSource: input.monthlyExpensesOverride === undefined ? 'finance' : 'manual',
    });
  })
  .get('/context', authMiddleware, async (c) =>
    c.json(await getAffordabilityContext(c.get('auth')!.userId)),
  );
