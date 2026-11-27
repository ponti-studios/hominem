import { removeUsers, resetUsers, seedAccounts } from '@hominem/finance-services/test/factory';
import { transactionsByIds } from '@hominem/finance-services/test/readers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { upsertTransaction } from '../../testkit/fixtures/finance-tool-calls';
import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f20000f0-0000-4000-8000-000000000001';
const checkingId = 'f20000f1-0000-4000-8000-000000000001';
const savingsId = 'f20000f1-0000-4000-8000-000000000002';

type Content = {
  id?: string | null;
  reason?: string | null;
  counterpartId?: string | null;
  transactions?: Array<Record<string, unknown>>;
  rejected?: Array<{ index: number; reason: string }>;
  created?: number;
  deleted?: unknown[];
};

const content = structuredContent<Content>;

beforeAll(async () => {
  await resetUsers(userId);
  await seedAccounts(userId, [
    { id: checkingId, name: 'Counterpart Checking' },
    { id: savingsId, name: 'Counterpart Savings', accountType: 'savings' },
  ]);
});

afterAll(() => removeUsers(userId));

describe('transfer counterpart linking', () => {
  it('mirrors the link on both rows and reads it back', async () => {
    const other = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Savings',
      description: 'Deposit',
    });
    const leg = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Checking',
      description: 'Transfer -> Savings',
      ...{
        counterpartId: other.id,
      },
    });
    expect(leg.reason).toBeNull();

    expect((await transactionsByIds([leg.id ?? '']))[0]?.counterpartId).toBe(other.id);
    expect((await transactionsByIds([other.id ?? '']))[0]?.counterpartId).toBe(leg.id);

    const search = content(
      await callTool(userId, 'finance_transaction_search', { query: 'Transfer -> Savings' }),
    );
    const row = search.transactions?.find((t) => t.id === leg.id);
    expect(row?.counterpartId).toBe(other.id);
  });

  it('rejects a counterpart on the same account', async () => {
    const sameAccount = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Checking',
      description: 'Same Account Row',
    });
    const result = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Checking',
      description: 'Same Account Link',
      ...{
        counterpartId: sameAccount.id,
      },
    });
    expect(result.reason).toBe('invalid_counterpart');
    expect(result.id).toBeNull();
  });

  it('rejects a counterpart that does not exist', async () => {
    const result = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Checking',
      description: 'Missing Link',
      ...{
        counterpartId: 'f20000f9-0000-4000-8000-000000000009',
      },
    });
    expect(result.reason).toBe('invalid_counterpart');
  });

  it('clears the counterpart link when a leg is deleted', async () => {
    const other = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Savings',
      description: 'Delete Deposit',
    });
    const leg = await upsertTransaction<Content>(userId, {
      account: 'Counterpart Checking',
      description: 'Delete Leg',
      ...{ counterpartId: other.id },
    });
    expect((await transactionsByIds([other.id ?? '']))[0]?.counterpartId).toBe(leg.id);

    await callTool(userId, 'finance_transaction_delete', {
      ids: [leg.id ?? ''],
      iUnderstand: true,
    });
    expect((await transactionsByIds([other.id ?? '']))[0]?.counterpartId).toBeNull();
  });

  it('surfaces an invalid counterpart as a per-row rejection in a dry run', async () => {
    const dry = content(
      await callTool(userId, 'finance_transactions_import', {
        mode: 'append',
        dryRun: true,
        transactions: [
          {
            postedOn: '2026-05-09',
            account: 'Counterpart Checking',
            description: 'Dry Bad Link',
            amountCents: -100,
            currencyCode: 'USD',
            counterpartId: 'f20000f9-0000-4000-8000-000000000009',
          },
        ],
      }),
    );
    expect(dry.created).toBe(0);
    expect(dry.rejected).toEqual([{ index: 0, reason: 'invalid_counterpart' }]);
  });
});
