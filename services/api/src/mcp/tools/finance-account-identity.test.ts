import { removeUsers, resetUsers } from '@hominem/finance-services/test/factory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listedAccounts } from '../../testkit/fixtures/finance-tool-calls';
import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f2000130-0000-4000-8000-000000000001';
const otherUserId = 'f2000130-0000-4000-8000-000000000002';

type Content = {
  id?: string | null;
  name?: string | null;
  created?: boolean;
  provider?: string | null;
  providerAccountId?: string | null;
  accountNumber?: string | null;
  updated?: boolean;
  dryRun?: boolean;
  changes?: Record<string, [string | null, string | null]>;
  reason?: string | null;
  accounts?: Array<{
    id?: string;
    name?: string;
    provider?: string | null;
    providerAccountId?: string | null;
    accountNumber?: string | null;
  }>;
};

const content = structuredContent<Content>;

beforeAll(async () => {
  await resetUsers(userId, otherUserId);
});

afterAll(() => removeUsers(userId, otherUserId));

describe('finance_account_create provider identity', () => {
  it('creates an account carrying its provider identity, normalized to lowercase', async () => {
    const result = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Test Current',
        currencyCode: 'GBP',
        provider: 'Starling',
        providerAccountId: 'test-primary-uid',
      }),
    );

    expect(result.created).toBe(true);
    expect(result.provider).toBe('starling');
    expect(result.providerAccountId).toBe('test-primary-uid');
  });

  it('routes by identity before the name — a renamed request still returns the same account', async () => {
    const result = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Totally Different Name',
        currencyCode: 'GBP',
        provider: 'starling',
        providerAccountId: 'test-primary-uid',
      }),
    );

    const original = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Current',
    );
    expect(result.created).toBe(false);
    expect(result.id).toBe(original?.id);
    // The stored name wins; identity routing never renames the account.
    expect(result.name).toBe('Test Current');
  });

  it('never stamps an identity onto a name-matched account — that is update work', async () => {
    const plain = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Test Card',
        currencyCode: 'GBP',
        accountNumber: '1234',
      }),
    );
    expect(plain.created).toBe(true);

    const matched = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Test Card',
        currencyCode: 'GBP',
        provider: 'plaid',
        providerAccountId: 'test-card-uid',
      }),
    );

    expect(matched.created).toBe(false);
    expect(matched.id).toBe(plain.id);
    expect(matched.provider).toBeNull();
    expect(matched.providerAccountId).toBeNull();
  });

  it('lists provider, providerAccountId and accountNumber for external routing', async () => {
    const current = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Current',
    );
    const card = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );

    expect(current?.provider).toBe('starling');
    expect(current?.providerAccountId).toBe('test-primary-uid');
    expect(card?.provider).toBeNull();
    expect(card?.accountNumber).toBe('1234');
  });

  it('allows the same identity for a different user — uniqueness is per owner', async () => {
    const result = content(
      await callTool(otherUserId, 'finance_account_create', {
        name: 'Other Current',
        currencyCode: 'GBP',
        provider: 'starling',
        providerAccountId: 'test-primary-uid',
      }),
    );

    const ours = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Current',
    );
    expect(result.created).toBe(true);
    expect(result.id).not.toBe(ours?.id);
  });
});

describe('finance_account_update provider identity', () => {
  it('stamps identity onto a name-matched account with a full changes audit', async () => {
    const card = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: card?.id,
        provider: 'plaid',
        providerAccountId: 'test-card-uid',
      }),
    );

    expect(result.reason).toBeNull();
    expect(result.updated).toBe(true);
    expect(result.changes?.provider).toEqual([null, 'plaid']);
    expect(result.changes?.providerAccountId).toEqual([null, 'test-card-uid']);

    const stored = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );
    expect(stored?.provider).toBe('plaid');
    expect(stored?.providerAccountId).toBe('test-card-uid');
  });

  it('refuses an identity another account already holds with identity_conflict', async () => {
    const card = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: card?.id,
        provider: 'starling',
        providerAccountId: 'test-primary-uid',
      }),
    );

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('identity_conflict');
    expect(result.changes).toEqual({});

    const stored = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );
    expect(stored?.provider).toBe('plaid');
  });

  it('refuses a provider id with no provider to anchor it', async () => {
    const fresh = content(
      await callTool(userId, 'finance_account_create', {
        name: 'Test Wallet',
        currencyCode: 'GBP',
      }),
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: fresh.id,
        providerAccountId: 'dangling-uid',
      }),
    );

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('identity_requires_provider');
  });

  it('refuses clearing the provider while a provider id stays set', async () => {
    const card = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: card?.id,
        provider: null,
      }),
    );

    expect(result.updated).toBe(false);
    expect(result.reason).toBe('identity_requires_provider');
  });

  it('clears the whole identity cleanly and reports both halves', async () => {
    const card = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: card?.id,
        provider: null,
        providerAccountId: null,
      }),
    );

    expect(result.reason).toBeNull();
    expect(result.updated).toBe(true);
    expect(result.changes?.provider).toEqual(['plaid', null]);
    expect(result.changes?.providerAccountId).toEqual(['test-card-uid', null]);

    const stored = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );
    expect(stored?.provider).toBeNull();
    expect(stored?.providerAccountId).toBeNull();
  });

  it('dryRun projects an identity change without writing it', async () => {
    const card = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );

    const result = content(
      await callTool(userId, 'finance_account_update', {
        accountId: card?.id,
        provider: 'starling',
        providerAccountId: 'test-saver-uid',
        dryRun: true,
      }),
    );

    expect(result.dryRun).toBe(true);
    expect(result.updated).toBe(true);
    expect(result.changes?.provider).toEqual([null, 'starling']);

    const stored = (await listedAccounts<NonNullable<Content['accounts']>[number]>(userId)).find(
      (row) => row.name === 'Test Card',
    );
    expect(stored?.provider).toBeNull();
    expect(stored?.providerAccountId).toBeNull();
  });
});
