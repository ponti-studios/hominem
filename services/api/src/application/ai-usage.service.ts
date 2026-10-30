import { assertUnderMonthlyUsageBudget, getMonthlyUsageStatus } from '@hominem/ai';

import { billingRules } from './billing.runtime';
import { assertBillingUsage, billingState } from './billing.service';

export {
  assertUnderMonthlyUsageLimit,
  getAIUsagePageReport,
  getMonthlyAIUsageReport,
  getMonthlyUsageStatus,
  recordAIUsageEvent,
  startAIUsageTimer,
} from '@hominem/ai';

export async function assertAIUsageAllowed(userId: string): Promise<void> {
  const state = await billingState(billingRules(), userId);
  await assertUnderMonthlyUsageBudget(userId, {
    limitUsd: state.limits.aiSpendUsdPerMonth,
    limitTokens: state.limits.aiTokensPerMonth,
  });
}

export async function getPlanMonthlyUsageStatus(userId: string) {
  const state = await billingState(billingRules(), userId);
  const status = await getMonthlyUsageStatus(
    userId,
    state.limits.aiSpendUsdPerMonth ?? Number.MAX_SAFE_INTEGER,
  );
  const limitTokens = state.limits.aiTokensPerMonth;
  const tokenPercent =
    limitTokens === null || limitTokens === 0 ? 0 : (status.totalTokens / limitTokens) * 100;
  const spendLimit = state.limits.aiSpendUsdPerMonth;
  const spendPercent =
    spendLimit === null || spendLimit === 0 ? 0 : (status.totalCostUsd / spendLimit) * 100;
  return {
    totalTokens: status.totalTokens,
    limitTokens,
    remainingTokens: limitTokens === null ? null : Math.max(0, limitTokens - status.totalTokens),
    unlimited: limitTokens === null,
    percentUsed:
      limitTokens === null ? 0 : Math.min(100, Math.round(Math.max(tokenPercent, spendPercent))),
    isOverLimit: status.isOverLimit || (limitTokens !== null && status.totalTokens >= limitTokens),
    periodStart: status.periodStart,
    periodEnd: status.periodEnd,
  };
}

/** Paid plans are capped by monthly provider tokens and an internal cost guard; Taster also keeps a message cap. */
export async function assertChatAllowed(userId: string): Promise<void> {
  await assertAIUsageAllowed(userId);
  await assertBillingUsage(billingRules(), userId, 'chat');
}
