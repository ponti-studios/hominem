import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertUnderMonthlyUsageLimit: vi.fn(),
  getOsmiumMembership: vi.fn(),
  billingRules: vi.fn(() => ({
    store: { getOsmiumMembership: mocks.getOsmiumMembership },
    config: {},
  })),
  assertBillingUsage: vi.fn(),
}));

vi.mock('@hominem/ai', () => ({
  assertUnderMonthlyUsageLimit: mocks.assertUnderMonthlyUsageLimit,
}));
vi.mock('./billing.runtime', () => ({ billingRules: mocks.billingRules }));
vi.mock('./billing.service', () => ({ assertBillingUsage: mocks.assertBillingUsage }));

import { assertAIUsageAllowed, assertChatAllowed } from './ai-usage.service';

describe('AI usage allowances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOsmiumMembership.mockResolvedValue(null);
  });

  it('keeps the monthly AI spend cap for regular accounts', async () => {
    await assertAIUsageAllowed('user-1');
    expect(mocks.assertUnderMonthlyUsageLimit).toHaveBeenCalledWith('user-1');
  });

  it('skips the monthly AI spend cap for Osmium members', async () => {
    mocks.getOsmiumMembership.mockResolvedValue({ tier: 'osmium' });
    await assertChatAllowed('member-1');
    expect(mocks.assertUnderMonthlyUsageLimit).not.toHaveBeenCalled();
    expect(mocks.assertBillingUsage).toHaveBeenCalledWith(expect.anything(), 'member-1', 'chat');
  });
});
