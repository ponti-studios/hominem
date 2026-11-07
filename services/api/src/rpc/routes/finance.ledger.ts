import {
  computeLedgerRunway,
  findTransferPairs,
  getAccountLedgerBreakdown,
  getReconciliationStaleness,
  getRunwaySettings,
  getValidationGates,
  postReconciliationAdjustment,
} from '@hominem/finance-services';
import { Hono } from 'hono';
import { z } from 'zod';

import { NotFoundError } from '../errors';
import type { AppContext } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { zValidator } from '../validator';

// Ledger-backed finance operations. These live behind the API so a browser app
// never imports @hominem/finance-services to read the books — see
// docs/web.sub-apps.md. The generic /finance/runway calculators are separate:
// /finance/ledger/runway derives from the user's actual transactions.

const accountParamsSchema = z.object({ id: z.string().uuid() });

const transferQuerySchema = z.object({
  windowDays: z.coerce.number().int().nonnegative().optional(),
  minAmount: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

const adjustmentSchema = z.object({
  accountId: z.string().uuid(),
  targetBalance: z.number().finite(),
  date: z.string().optional(),
  note: z.string().max(500).optional(),
  force: z.boolean().optional(),
});

export const ledgerRoutes = new Hono<AppContext>()
  .get('/reconcile', authMiddleware, async (c) => {
    const userId = c.get('auth')!.userId;
    const [staleness, gates] = await Promise.all([
      getReconciliationStaleness(userId),
      getValidationGates(userId),
    ]);
    return c.json({ staleness, gates });
  })
  .get('/accounts/:id', authMiddleware, zValidator('param', accountParamsSchema), async (c) => {
    const breakdown = await getAccountLedgerBreakdown(
      c.get('auth')!.userId,
      c.req.valid('param').id,
    );
    if (!breakdown) {
      throw new NotFoundError('Account not found');
    }
    return c.json(breakdown);
  })
  .post('/adjustment', authMiddleware, zValidator('json', adjustmentSchema), async (c) => {
    const result = await postReconciliationAdjustment({
      userId: c.get('auth')!.userId,
      ...c.req.valid('json'),
    });
    return c.json(result);
  })
  .get('/transfers', authMiddleware, zValidator('query', transferQuerySchema), async (c) => {
    const pairs = await findTransferPairs({
      userId: c.get('auth')!.userId,
      ...c.req.valid('query'),
    });
    return c.json({ pairs });
  })
  .get('/runway', authMiddleware, async (c) => {
    const userId = c.get('auth')!.userId;
    const settings = await getRunwaySettings(userId);
    const runway = await computeLedgerRunway({
      userId,
      currencyCode: settings.currencyCode,
      monthlyBudgets: settings.budgets.map(({ category, amount, currencyCode }) => ({
        category,
        amount,
        currencyCode,
      })),
    });
    return c.json({ settings, runway });
  });
