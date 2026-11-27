import crypto from 'node:crypto';

import { isIntegrationDatabaseAvailable } from '@hominem/db/test/utils';
import { expect } from 'vitest';

import { createAccount } from './index';
import {
  computeLedgerRunway,
  getAffordabilityContext,
  getRunwaySettings,
  saveRunwayBudget,
  saveRunwayCurrency,
} from './runway';
import { patchAccount, seedCategory, seedTransaction } from './test/factory';
import { financeIntegrationTest } from './test/fixtures';

const describeIntegration = (await isIntegrationDatabaseAvailable())
  ? financeIntegrationTest.describe
  : financeIntegrationTest.describe.skip;

describeIntegration('finance runway integration', () => {
  let ownerId: string;
  let otherUserId: string;
  let checkingId: string;

  financeIntegrationTest.beforeEach(async ({ financeFixture }) => {
    ownerId = financeFixture.ownerId;
    otherUserId = financeFixture.otherUserId;

    const checking = await createAccount({
      userId: ownerId,
      name: 'Checking',
      accountType: 'checking',
    });
    checkingId = checking.id;
    await createAccount({
      userId: ownerId,
      name: 'Imported Savings',
      accountType: 'depository',
    });
    const savings = await createAccount({
      userId: ownerId,
      name: 'Savings',
      accountType: 'savings',
    });
    const card = await createAccount({
      userId: ownerId,
      name: 'Card',
      accountType: 'credit_card',
    });

    await seedTransaction({
      userId: ownerId,
      accountId: checkingId,
      amount: 2000,
      transactionType: 'credit',
      description: 'Paycheck',
      postedOn: '2026-03-15',
    });
    await seedTransaction({
      userId: ownerId,
      accountId: savings.id,
      amount: 500,
      transactionType: 'credit',
      description: 'Transfer in',
      postedOn: '2026-02-01',
    });
    await seedTransaction({
      userId: ownerId,
      accountId: card.id,
      amount: -300,
      transactionType: 'debit',
      description: 'Spending',
      postedOn: '2026-03-01',
    });

    await seedTransaction({
      userId: ownerId,
      accountId: checkingId,
      amount: -100,
      transactionType: 'debit',
      description: 'StreamCo',
      postedOn: '2026-01-05',
      recurring: true,
    });
    await seedTransaction({
      userId: ownerId,
      accountId: checkingId,
      amount: -70,
      transactionType: 'debit',
      description: 'StreamCo',
      postedOn: '2026-02-05',
      recurring: true,
    });
    await seedTransaction({
      userId: ownerId,
      accountId: checkingId,
      amount: -70,
      transactionType: 'debit',
      description: 'StreamCo',
      postedOn: '2026-03-05',
      recurring: true,
    });
  });

  financeIntegrationTest(
    'sums starting cash over liquid types and projects weekly burn',
    async () => {
      const result = await computeLedgerRunway({
        userId: ownerId,
        monthlyBudgets: [
          { category: 'Groceries', amount: 200, currencyCode: 'USD' },
          { category: 'Dining', amount: 100, currencyCode: 'USD', note: 'cap' },
        ],
        currencyCode: 'USD',
        projectionWeeks: 2,
        asOf: '2026-04-01',
      });

      expect(result.asOfDate).toBe('2026-04-01');
      expect(result.liquidAccounts).toEqual([
        { accountName: 'Checking', balance: 1760 },
        { accountName: 'Imported Savings', balance: 0 },
        { accountName: 'Savings', balance: 500 },
      ]);
      expect(result.startingCash).toBe(2260);
      expect(result.weeklyRecurringOutflow).toBe(18.4);
      expect(result.recurringTxnCount).toBe(3);
      expect(result.weeklyVariableAllowance).toBe(68.99);
      expect(result.weeks).toHaveLength(2);
      expect(result.weeks[0]).toMatchObject({
        week: 1,
        weekStart: '2026-04-01',
        weekEnd: '2026-04-07',
        beginningCash: 2260,
        recurringOutflows: 18.4,
        variableAllowance: 68.99,
        netChange: -87.39,
        endingCash: 2172.61,
      });
      expect(result.weeks[1]).toMatchObject({
        week: 2,
        weekStart: '2026-04-08',
        weekEnd: '2026-04-14',
        beginningCash: 2172.61,
        endingCash: 2085.22,
      });
    },
  );

  financeIntegrationTest(
    'ignores adjustments, credits, out-of-window, and excluded rows in the recurring average',
    async () => {
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -50,
        transactionType: 'adjustment',
        description: 'Balance reconciliation adjustment',
        postedOn: '2026-02-10',
        recurring: true,
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: 30,
        transactionType: 'credit',
        description: 'Refund',
        postedOn: '2026-02-12',
        recurring: true,
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -60,
        transactionType: 'debit',
        description: 'StreamCo',
        postedOn: '2025-12-01',
        recurring: true,
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -60,
        transactionType: 'debit',
        description: 'StreamCo',
        postedOn: '2026-03-20',
        recurring: true,
        excluded: true,
      });

      const result = await computeLedgerRunway({
        userId: ownerId,
        monthlyBudgets: [],
        currencyCode: 'USD',
        asOf: '2026-04-01',
      });

      expect(result.recurringTxnCount).toBe(3);
      expect(result.weeklyRecurringOutflow).toBe(18.4);
      expect(result.weeklyVariableAllowance).toBe(0);
    },
  );

  financeIntegrationTest('scopes every input to the current user', async () => {
    const result = await computeLedgerRunway({
      userId: otherUserId,
      monthlyBudgets: [{ category: 'Groceries', amount: 200, currencyCode: 'USD' }],
      currencyCode: 'USD',
      projectionWeeks: 1,
      asOf: '2026-04-01',
    });

    expect(result.startingCash).toBe(0);
    expect(result.liquidAccounts).toEqual([]);
    expect(result.recurringTxnCount).toBe(0);
    expect(result.weeklyVariableAllowance).toBe(46);
    expect(result.weeks[0]?.endingCash).toBe(-46);
  });

  financeIntegrationTest('rejects invalid projection inputs', async () => {
    await expect(
      computeLedgerRunway({ userId: ownerId, monthlyBudgets: [], asOf: '04/01/2026' }),
    ).rejects.toThrow(/YYYY-MM-DD/);
    await expect(
      computeLedgerRunway({ userId: ownerId, monthlyBudgets: [], projectionWeeks: 0 }),
    ).rejects.toThrow(/positive integer/);
    await expect(
      computeLedgerRunway({
        userId: ownerId,
        monthlyBudgets: [{ category: 'Groceries', amount: -5 }],
      }),
    ).rejects.toThrow(/non-negative/);
  });

  financeIntegrationTest(
    'keeps cash, recurring debits, and caps inside the selected currency and user',
    async () => {
      const euro = await createAccount({
        userId: ownerId,
        name: 'Euro checking',
        accountType: 'checking',
        currencyCode: 'EUR',
      });
      await seedTransaction({
        userId: ownerId,
        accountId: euro.id,
        amount: 500,
        transactionType: 'credit',
        description: 'Opening',
        postedOn: '2026-03-01',
        currencyCode: 'EUR',
      });
      await seedTransaction({
        userId: ownerId,
        accountId: euro.id,
        amount: -90,
        transactionType: 'debit',
        description: 'Rent',
        postedOn: '2026-02-01',
        recurring: true,
        currencyCode: 'EUR',
      });
      await seedTransaction({
        userId: ownerId,
        accountId: euro.id,
        amount: -90,
        transactionType: 'debit',
        description: 'Rent',
        postedOn: '2026-03-01',
        recurring: true,
        currencyCode: 'EUR',
      });
      const categoryId = crypto.randomUUID();
      const otherCategoryId = crypto.randomUUID();
      await seedCategory({ id: categoryId, userId: ownerId, name: 'Rent' });
      await seedCategory({ id: otherCategoryId, userId: otherUserId, name: 'Other rent' });
      await saveRunwayBudget({ userId: ownerId, categoryId, currencyCode: 'EUR', amount: 300 });
      await saveRunwayCurrency(ownerId, 'EUR');

      const settings = await getRunwaySettings(ownerId);
      expect(settings.currencyCode).toBe('EUR');
      expect(settings.budgets).toHaveLength(1);
      await expect(
        saveRunwayBudget({
          userId: ownerId,
          categoryId: otherCategoryId,
          currencyCode: 'EUR',
          amount: 999,
        }),
      ).rejects.toThrow(/Category not found/);

      const result = await computeLedgerRunway({
        userId: ownerId,
        currencyCode: 'EUR',
        monthlyBudgets: settings.budgets.map(({ category, amount, currencyCode }) => ({
          category,
          amount,
          currencyCode,
        })),
        asOf: '2026-04-01',
      });
      expect(result.startingCash).toBe(320);
      expect(result.recurringTxnCount).toBe(2);
      expect(result.weeklyRecurringOutflow).toBeCloseTo(13.8, 1);
      expect(result.weeklyVariableAllowance).toBeCloseTo(69, 0);
      expect(result.warnings).toContain('Only EUR is included. Other currencies excluded: USD.');
    },
  );

  financeIntegrationTest(
    'includes currencies allowed on a liquid account even when they are not its primary currency',
    async () => {
      await patchAccount(checkingId, { allowedCurrencies: ['USD', 'GBP'] });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: 300,
        transactionType: 'credit',
        description: 'GBP opening balance',
        postedOn: '2026-03-01',
        currencyCode: 'GBP',
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -60,
        transactionType: 'debit',
        description: 'GBP recurring expense',
        postedOn: '2026-03-05',
        recurring: true,
        currencyCode: 'GBP',
      });

      const settings = await getRunwaySettings(ownerId);
      expect(settings.currencies).toContain('GBP');
      await saveRunwayCurrency(ownerId, 'GBP');
      const result = await computeLedgerRunway({
        userId: ownerId,
        currencyCode: 'GBP',
        monthlyBudgets: [{ category: 'GBP cap', amount: 100, currencyCode: 'GBP' }],
        asOf: '2026-04-01',
        projectionWeeks: 1,
      });

      expect(result.liquidAccounts).toEqual([{ accountName: 'Checking', balance: 240 }]);
      expect(result.startingCash).toBe(240);
      expect(result.recurringTxnCount).toBe(1);
      expect(result.weeklyVariableAllowance).toBe(23);
    },
  );

  financeIntegrationTest(
    'builds a six-complete-month affordability context from one currency and the current user',
    async () => {
      const otherChecking = await createAccount({
        userId: otherUserId,
        name: 'Other checking',
        accountType: 'checking',
      });
      const euroChecking = await createAccount({
        userId: ownerId,
        name: 'Euro checking',
        accountType: 'checking',
        currencyCode: 'EUR',
      });
      await saveRunwayCurrency(ownerId, 'USD');
      await seedTransaction({
        userId: ownerId,
        accountId: euroChecking.id,
        amount: 1000,
        transactionType: 'credit',
        description: 'Euro balance',
        postedOn: '2026-03-10',
        currencyCode: 'EUR',
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -60,
        transactionType: 'debit',
        description: 'Excluded expense',
        postedOn: '2026-03-10',
        excluded: true,
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -30,
        transactionType: 'debit',
        description: 'Pending expense',
        postedOn: '2026-03-11',
        pending: true,
      });
      await seedTransaction({
        userId: ownerId,
        accountId: checkingId,
        amount: -40,
        transactionType: 'debit',
        description: 'Current partial month',
        postedOn: '2026-04-01',
      });
      await seedTransaction({
        accountId: otherChecking.id,
        amount: -90,
        transactionType: 'debit',
        description: 'Other user expense',
        postedOn: '2026-03-10',
        userId: otherUserId,
      });

      const result = await getAffordabilityContext(ownerId, '2026-04-15');

      expect(result).toMatchObject({
        currencyCode: 'USD',
        startingCash: 2190,
        monthlyIncome: 416.67,
        monthlyExpenses: 90,
        historyStartDate: '2025-10-01',
        historyEndDate: '2026-03-31',
        historyMonthCount: 6,
        transactionCount: 6,
      });
      expect(result.availableCurrencies).toContain('USD');
      expect(result.availableCurrencies).toContain('EUR');
      expect(result.warnings).toContain('Only USD is included. Other currencies excluded: EUR.');
      expect(result.warnings).not.toContain(
        'No posted transaction history is available in USD for this period.',
      );
    },
  );

  financeIntegrationTest(
    'returns missing-source signals for an unconfigured currency, balance, or history',
    async () => {
      const emptyChecking = await createAccount({
        userId: otherUserId,
        name: 'Empty checking',
        accountType: 'checking',
      });
      expect(emptyChecking).toBeDefined();

      const unconfigured = await getAffordabilityContext(otherUserId, '2026-04-15');
      expect(unconfigured.currencyCode).toBeNull();
      expect(unconfigured.startingCash).toBeNull();
      expect(unconfigured.warnings[0]).toContain('Choose a Finance currency');

      await saveRunwayCurrency(otherUserId, 'USD');
      const configured = await getAffordabilityContext(otherUserId, '2026-04-15');
      expect(configured.startingCash).toBe(0);
      expect(configured.monthlyIncome).toBeNull();
      expect(configured.monthlyExpenses).toBeNull();
      expect(configured.warnings).toContain(
        'No posted transaction history is available in USD for this period.',
      );
    },
  );
});
