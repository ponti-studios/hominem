import { assertUnderMonthlyUsageLimit } from '@hominem/ai';

import { billingRules } from './billing.runtime';
import { assertBillingUsage } from './billing.service';

export {
  assertUnderMonthlyUsageLimit,
  getAIUsagePageReport,
  getMonthlyAIUsageReport,
  getMonthlyUsageStatus,
  recordAIUsageEvent,
  startAIUsageTimer,
} from '@hominem/ai';

export async function assertAIUsageAllowed(userId: string, isAdmin = false): Promise<void> {
  if (!isAdmin) await assertUnderMonthlyUsageLimit(userId);
}

/**
 * Both gates a conversation must pass: the provider-cost cap every AI feature already had, and the
 * plan's monthly message volume. Every tier has a finite message cap, so no plan has uncapped chat.
 */
export async function assertChatAllowed(userId: string, isAdmin = false): Promise<void> {
  await assertAIUsageAllowed(userId, isAdmin);
  await assertBillingUsage(billingRules(), userId, 'chat', undefined, { isAdmin });
}
