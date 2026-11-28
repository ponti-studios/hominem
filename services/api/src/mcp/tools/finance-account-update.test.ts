import {
  removeUsers,
  resetUsers,
  seedAccounts,
  seedTransaction,
} from '@hominem/finance-services/test/factory';
import { accountById } from '@hominem/finance-services/test/readers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f2000100-0000-4000-8000-000000000001';
const otherUserId = 'f2000100-0000-4000-8000-000000000002';
const typoId = 'f2000101-0000-4000-8000-000000000001';
const appleId = 'f2000101-0000-4000-8000-000000000002';
const probeId = 'f2000101-0000-4000-8000-000000000003';
const otherAccountId = 'f2000101-0000-4000-8000-000000000004';

type Content = {
  id?: string | null;
  name?: string | null;
  currencyCode?: string | null;
  status?: string | null;
  updated?: boolean;
  changes?: Record<string, [string | null, string | null]>;
  reason?: string | null;
  accounts?: Array<{
    id?: string;
    accountId?: string;
    accountName?: string;
    name?: string;
    lifecycleStatus?: string;
    transactionCount?: number;
  }>;
  transactionCount?: number;
  allowedCurrencies?: string[];
};

const content = structuredContent<Content>;

beforeAll(async () => {
  await resetUsers(userId, otherUserId);
  await seedAccounts(userId, [
    { id: typoId, name: 'Exmaple Broker' },
    { id: appleId, name: 'Example Savings', accountType: 'savings' },
    {
      id: probeId,
      name: 'ZZZ Probe Account',
      lifecycleStatus: 'closed',
      includeInNetWorth: false,
    },
    { id: otherAccountId, userId: otherUserId, name: 'Other Account' },
  ]);
  await seedTransaction({
    id: 'f2000102-0000-4000-8000-000000000001',
    userId,
    accountId: typoId,
    postedOn: '2026-07-01',
    description: 'Kept row',
    amount: -1234,
    externalId: 'acct-update-ext-1',
  });
});

afterAll(() => removeUsers(userId, otherUserId));

describe('finance_account_update', () => {
  it('fixes a name typo and keeps the account identity and its history', async () => {
    const before = content(
      await callTool(userId, 'finance_account_summary', { accountId: typoId }),
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: typoId,
        name: 'Example Broker',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result).toMatchObject({ updated: true, dryRun: false });
    expect(result.id).toBe(typoId);
    expect(result.changes).toEqual({ name: ['Exmaple Broker', 'Example Broker'] });
    expect((await accountById(typoId))?.name).toBe('Example Broker');

    const after = content(await callTool(userId, 'finance_account_summary', { accountId: typoId }));
    expect(after.accounts?.[0]).toMatchObject({ accountId: typoId, accountName: 'Example Broker' });
    expect(after.accounts?.[0]?.transactionCount).toBe(before.accounts?.[0]?.transactionCount);
  });

  it('refuses a rename that clashes with another account', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'example broker',
      }),
    );
    expect(result.reason).toBe('name_conflict');
    expect((await accountById(appleId))?.name).toBe('Example Savings');
    expect((await accountById(typoId))?.name).toBe('Example Broker');
  });

  it('allows re-casing the account’s own name', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'example savings',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result).toMatchObject({ updated: true, dryRun: false });
    expect(result.changes).toEqual({ name: ['Example Savings', 'example savings'] });
  });

  it('reports a no-op as updated: false with an empty change set', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'example savings',
      }),
    );
    expect(result.reason).toBeNull();
    expect(result.updated).toBe(false);
    expect(result.changes).toEqual({});
  });

  it('round-trips status and respects the closed-visibility rule', async () => {
    const opened = content(
      await callTool(userId, 'finance_account_update', { accountId: probeId, status: 'open' }),
    );
    expect(opened.changes).toEqual({ status: ['closed', 'open'] });

    const defaultView = content(await callTool(userId, 'finance_accounts', {}));
    expect(defaultView.accounts?.some((row) => row.id === probeId)).toBe(true);

    const closed = content(
      await callTool(userId, 'finance_account_update', { accountId: probeId, status: 'closed' }),
    );
    expect(closed.changes).toEqual({ status: ['open', 'closed'] });

    const afterClose = content(await callTool(userId, 'finance_accounts', {}));
    expect(afterClose.accounts?.some((row) => row.id === probeId)).toBe(false);
    const withClosed = content(await callTool(userId, 'finance_accounts', { includeClosed: true }));
    expect(withClosed.accounts?.some((row) => row.id === probeId)).toBe(true);
  });

  it('projects a dry run without applying it', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        name: 'Example Savings',
        dryRun: true,
      }),
    );
    expect(result).toMatchObject({ updated: true, dryRun: true });
    expect(result.changes).toEqual({ name: ['example savings', 'Example Savings'] });
    expect((await accountById(appleId))?.name).toBe('example savings');
  });

  it('refuses a currency change and a blank name', async () => {
    const currency = content(
      await callTool(userId, 'finance_account_update', { accountId: appleId, currencyCode: 'GBP' }),
    );
    expect(currency.reason).toBe('currency_immutable');

    const blank = content(
      await callTool(userId, 'finance_account_update', { accountId: appleId, name: '   ' }),
    );
    expect(blank.reason).toBe('invalid_name');
  });

  it('sets and clears the institution and mask', async () => {
    const set = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        institution: 'Example Bank',
        accountNumber: '0895',
      }),
    );
    expect(set.updated).toBe(true);
    expect(set.changes?.institution).toEqual([null, 'Example Bank']);
    expect(set.changes?.accountNumber).toEqual([null, '0895']);

    const cleared = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        institution: null,
        accountNumber: null,
      }),
    );
    expect(cleared.changes?.institution).toEqual(['Example Bank', null]);
    expect(cleared.changes?.accountNumber).toEqual(['0895', null]);
  });

  it('updates accountType when provided', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        accountType: 'investment',
      }),
    );
    expect(result).toMatchObject({
      updated: true,
      changes: { accountType: ['savings', 'investment'] },
    });
  });

  it('updates allowed currencies while preserving the primary currency', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        allowedCurrencies: ['GBP'],
      }),
    );
    expect(result).toMatchObject({
      currencyCode: 'USD',
      allowedCurrencies: ['USD', 'GBP'],
      updated: true,
    });

    const row = await accountById(appleId);
    expect(row).toMatchObject({ currencyCode: 'USD', allowedCurrencies: ['USD', 'GBP'] });

    const reordered = content(
      await callTool(userId, 'finance_account_update', {
        accountId: appleId,
        allowedCurrencies: ['GBP', 'USD'],
      }),
    );
    expect(reordered).toMatchObject({
      allowedCurrencies: ['USD', 'GBP'],
      updated: false,
      changes: {},
    });
  });
  it('never updates another user’s account', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: otherAccountId,
        name: 'Hijacked',
      }),
    );
    expect(result.reason).toBe('unknown_account');
    expect((await accountById(otherAccountId))?.name).toBe('Other Account');
  });

  it('reports an unknown account id', async () => {
    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: 'f2000109-0000-4000-8000-000000000009',
        name: 'Nope',
      }),
    );
    expect(result.reason).toBe('unknown_account');
  });
});
