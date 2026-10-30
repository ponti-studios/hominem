import { Hono } from 'hono';

import {
  getMonthlyAIUsageReport,
  getPlanMonthlyUsageStatus,
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
    const [report, monthly] = await Promise.all([
      getAIUsagePageReport(auth.userId),
      getPlanMonthlyUsageStatus(auth.userId),
    ]);
    return c.json({
      range: report.range,
      monthly,
      summary: {
        requestCount: report.summary.requestCount,
        usageAvailableCount: report.summary.usageAvailableCount,
        failedCount: report.summary.failedCount,
        cachedInputTokens: report.summary.cachedInputTokens,
        reasoningTokens: report.summary.reasoningTokens,
        totalTokens: report.summary.totalTokens,
      },
      byFeature: report.byFeature.map(({ feature, totalTokens, requestCount }) => ({
        feature,
        totalTokens,
        requestCount,
      })),
      byModel: report.byModel.map(({ model, totalTokens, requestCount }) => ({
        model,
        totalTokens,
        requestCount,
      })),
      byOperation: report.byOperation.map(({ operation, totalTokens, requestCount }) => ({
        operation,
        totalTokens,
        requestCount,
      })),
      daily: report.daily.map(({ bucketStart, totalTokens, requestCount }) => ({
        bucketStart,
        totalTokens,
        requestCount,
      })),
      monthlyTrend: report.monthlyTrend.map(({ bucketStart, totalTokens, requestCount }) => ({
        bucketStart,
        totalTokens,
        requestCount,
      })),
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
    return c.json(await getPlanMonthlyUsageStatus(auth.userId));
  });
