import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertUnderMonthlyUsageLimit: vi.fn(),
  billingRules: vi.fn(() => ({ store: {}, config: {} })),
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
  });

  it('keeps the monthly AI spend cap for regular accounts', async () => {
    await assertAIUsageAllowed('user-1');
    expect(mocks.assertUnderMonthlyUsageLimit).toHaveBeenCalledWith('user-1');
  });

  it('skips spend and plan caps for administrators', async () => {
    await assertChatAllowed('admin-1', true);

    expect(mocks.assertUnderMonthlyUsageLimit).not.toHaveBeenCalled();
    expect(mocks.assertBillingUsage).toHaveBeenCalledWith(
      expect.anything(),
      'admin-1',
      'chat',
      undefined,
      { isAdmin: true },
    );
  });
});
