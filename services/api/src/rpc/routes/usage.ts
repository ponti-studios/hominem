import { Hono } from 'hono';

import {
  getMonthlyAIUsageReport,
  getMonthlyUsageStatus,
  getAIUsagePageReport,
} from '../../application/ai-usage.service';
import { billingRules } from '../../application/billing.runtime';
import { getSpeechUsageHealth } from '../../application/speech-usage.service';
import { ForbiddenError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

export const usageRoutes = new Hono<AppContext>()
  .use('*', authMiddleware)
  .get('/', async (c) => {
    const auth = c.get('auth')!;
    const [report, membership] = await Promise.all([
      getMonthlyAIUsageReport(auth.userId),
      billingRules().store.getOsmiumMembership(auth.userId),
    ]);
    return c.json({
      ...report,
      monthly: membership ? { ...report.monthly, unlimited: true } : report.monthly,
    });
  })
  // Everything the hosted /auth/settings/ai page renders, in one payload.
  .get('/ai', async (c) => {
    const auth = c.get('auth')!;
    const [report, membership] = await Promise.all([
      getAIUsagePageReport(auth.userId),
      billingRules().store.getOsmiumMembership(auth.userId),
    ]);
    return c.json({
      ...report,
      monthly: membership ? { ...report.monthly, unlimited: true } : report.monthly,
    });
  })
  .get('/health', async (c) => {
    if (!c.get('auth')!.user.isAdmin) {
      throw new ForbiddenError('Administrative access required');
    }
    return c.json(await getSpeechUsageHealth());
  })
  .get('/monthly', async (c) => {
    const auth = c.get('auth')!;
    const [status, membership] = await Promise.all([
      getMonthlyUsageStatus(auth.userId),
      billingRules().store.getOsmiumMembership(auth.userId),
    ]);
    return c.json(membership ? { ...status, unlimited: true } : status);
  });
