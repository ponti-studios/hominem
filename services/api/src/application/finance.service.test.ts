import { describe, expect, it, vi } from 'vitest';

const repositories = vi.hoisted(() => ({
  financeMonthlySummary: vi.fn(),
}));

vi.mock('@hominem/db', () => ({
  FinanceQueryRepository: {
    monthlySummary: repositories.financeMonthlySummary,
  },
}));

import { FinanceService } from './finance.service';

const userId = '11111111-1111-4111-8111-111111111111';

const summary = {
  month: '2026-03',
  startsOn: '2026-03-01',
  endsBefore: '2026-04-01',
  currencyCode: 'USD',
  totalSpent: 162.5,
  totalIncome: 2000,
  transactionCount: 3,
  topMerchants: [
    {
      merchantName: 'Nashville Hotel',
      totalSpent: 120,
      transactionCount: 1,
    },
  ],
  transactions: [
    {
      transactionId: '22222222-2222-4222-8222-222222222222',
      accountId: '33333333-3333-4333-8333-333333333333',
      accountName: 'Personal Checking',
      institutionName: 'Test Bank',
      postedOn: '2026-03-09',
      amount: -120,
      transactionType: 'debit',
      merchantName: 'Nashville Hotel',
    },
  ],
};

describe('FinanceService', () => {
  it('returns schema-validated monthly finance summaries', async () => {
    repositories.financeMonthlySummary.mockResolvedValueOnce(summary);
    const service = new FinanceService();

    const result = await service.monthlySummary(userId, { month: '2026-03', limit: 25 });

    expect(repositories.financeMonthlySummary).toHaveBeenCalledWith(userId, {
      month: '2026-03',
      limit: 25,
    });
    expect(result).toEqual(summary);
  });

  it('keeps sensitive transaction body fields out of the DTO', async () => {
    repositories.financeMonthlySummary.mockResolvedValueOnce(summary);
    const service = new FinanceService();

    const result = await service.monthlySummary(userId, { month: '2026-03', limit: 25 });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('providerPayload');
    expect(serialized).not.toContain('description');
    expect(serialized).not.toContain('notes');
    expect(result.transactions[0]).toEqual({
      transactionId: '22222222-2222-4222-8222-222222222222',
      accountId: '33333333-3333-4333-8333-333333333333',
      accountName: 'Personal Checking',
      institutionName: 'Test Bank',
      postedOn: '2026-03-09',
      amount: -120,
      transactionType: 'debit',
      merchantName: 'Nashville Hotel',
    });
  });

  it('rejects repository rows that do not match the public summary contract', async () => {
    repositories.financeMonthlySummary.mockResolvedValueOnce({
      ...summary,
      transactions: [{ ...summary.transactions[0], transactionId: 'not-a-uuid' }],
    });
    const service = new FinanceService();

    await expect(service.monthlySummary(userId, { month: '2026-03', limit: 25 })).rejects.toThrow();
  });
});
