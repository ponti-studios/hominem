import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertUnderMonthlyUsageBudget: vi.fn(),
  billingState: vi.fn(),
  assertBillingUsage: vi.fn(),
}));

vi.mock('@hominem/ai', () => ({
  assertUnderMonthlyUsageBudget: mocks.assertUnderMonthlyUsageBudget,
  assertUnderMonthlyUsageLimit: vi.fn(),
  getMonthlyUsageStatus: vi.fn(),
}));
vi.mock('./billing.runtime', () => ({ billingRules: vi.fn(() => ({ config: {} })) }));
vi.mock('./billing.service', () => ({
  assertBillingUsage: mocks.assertBillingUsage,
  billingState: mocks.billingState,
}));

import { assertAIUsageAllowed, assertChatAllowed } from './ai-usage.service';

describe('AI usage allowances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.billingState.mockResolvedValue({
      plan: 'core',
      limits: { aiTokensPerMonth: 3_900_000, aiSpendUsdPerMonth: 2.5 },
    });
  });

  it('applies the plan token budget and provider spend guard', async () => {
    await assertAIUsageAllowed('user-1');
    expect(mocks.assertUnderMonthlyUsageBudget).toHaveBeenCalledWith('user-1', {
      limitUsd: 2.5,
      limitTokens: 3_900_000,
    });
  });

  it('skips token and spend limits for Osmium members', async () => {
    mocks.billingState.mockResolvedValue({
      plan: 'osmium',
      limits: { aiTokensPerMonth: null, aiSpendUsdPerMonth: null },
    });
    await assertChatAllowed('member-1');
    expect(mocks.assertUnderMonthlyUsageBudget).toHaveBeenCalledWith('member-1', {
      limitUsd: null,
      limitTokens: null,
    });
    expect(mocks.assertBillingUsage).toHaveBeenCalledWith(expect.anything(), 'member-1', 'chat');
  });
});
