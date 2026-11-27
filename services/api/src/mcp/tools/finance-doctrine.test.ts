import { removeUsers, resetUsers } from '@hominem/finance-services/test/factory';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { doctrineFixture } from '../../testkit/fixtures/finance-doctrine';
import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool } from '../tool-registry';
import './finance';

const userId = 'f2000120-0000-4000-8000-000000000001';
const otherUserId = 'f2000120-0000-4000-8000-000000000002';

type Content = {
  fingerprint?: string | null;
  updatedAt?: string | null;
  status?: 'created' | 'replaced' | 'unchanged' | null;
  dryRun?: boolean;
  ruleCounts?: Record<string, number>;
  doctrine?: {
    version?: number;
    merchantRules?: Array<{
      matchMode?: string;
      pattern?: string;
      category?: string;
      note?: string;
    }>;
    tagRules?: Array<{ matchMode?: string; pattern?: string; tags?: string[] }>;
    amountRules?: Array<{ merchant?: string; amountMinorUnits?: number[]; category?: string }>;
    transferMerchants?: Array<{ matchMode?: string; pattern?: string }>;
    incomePatterns?: Array<{ matchMode?: string; pattern?: string }>;
    coffeePatterns?: string[];
    lenses?: Array<{ category?: string; matches?: Array<{ pattern?: string; tag?: string }> }>;
  } | null;
};

const content = structuredContent<Content>;

beforeAll(async () => {
  await resetUsers(userId, otherUserId);
});

afterAll(() => removeUsers(userId, otherUserId));

describe('finance_doctrine_get', () => {
  it('returns empty nulls when no doctrine is stored', async () => {
    expect(content(await callTool(userId, 'finance_doctrine_get', {}))).toEqual({
      fingerprint: null,
      updatedAt: null,
      doctrine: null,
    });
  });
});

describe('finance_doctrine_import', () => {
  it('creates the first doctrine and echoes the stored shape with defaults applied', async () => {
    const result = content(
      await callTool(userId, 'finance_doctrine_import', {
        doctrine: doctrineFixture(),
        dryRun: false,
      }),
    );

    expect(result.status).toBe('created');
    expect(result.dryRun).toBe(false);
    expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(result.updatedAt).toEqual(expect.any(String));
    expect(result.ruleCounts).toMatchObject({
      merchantRules: 2,
      tagRules: 1,
      amountRules: 1,
      transferMerchants: 1,
      incomePatterns: 1,
      coffeePatterns: 1,
      lenses: 1,
    });

    const stored = content(await callTool(userId, 'finance_doctrine_get', {}));
    expect(stored.fingerprint).toBe(result.fingerprint);
    expect(stored.updatedAt).toBe(result.updatedAt);
    expect(stored.doctrine?.merchantRules?.[0]).toMatchObject({
      matchMode: 'contains',
      pattern: 'Test Coffee Co',
      category: 'Food',
      note: 'Dated ruling 2026-11-22: kept for the audit trail.',
    });
    // matchMode defaults are canonicalized on write, so reads always carry them.
    expect(stored.doctrine?.tagRules?.[0]?.matchMode).toBe('contains');
    expect(stored.doctrine?.transferMerchants?.[0]?.matchMode).toBe('exact');
  });

  it('is unchanged when identical doctrine is re-imported', async () => {
    const before = content(await callTool(userId, 'finance_doctrine_get', {}));

    const result = content(
      await callTool(userId, 'finance_doctrine_import', {
        doctrine: doctrineFixture(),
        dryRun: false,
      }),
    );

    expect(result.status).toBe('unchanged');
    expect(result.updatedAt).toBe(before.updatedAt);
  });

  it('replaces stored doctrine when the contents change', async () => {
    const next = doctrineFixture();
    next.merchantRules.push({
      matchMode: 'contains',
      pattern: 'Test Bookshop',
      category: 'Shopping',
    });

    const result = content(
      await callTool(userId, 'finance_doctrine_import', { doctrine: next, dryRun: false }),
    );

    expect(result.status).toBe('replaced');
    const stored = content(await callTool(userId, 'finance_doctrine_get', {}));
    expect(stored.fingerprint).toBe(result.fingerprint);
    expect(stored.doctrine?.merchantRules).toHaveLength(3);
  });

  it('dryRun reports a replacement without writing it', async () => {
    const before = content(await callTool(userId, 'finance_doctrine_get', {}));
    const next = doctrineFixture();
    next.coffeePatterns.push('test tea');

    const result = content(
      await callTool(userId, 'finance_doctrine_import', { doctrine: next, dryRun: true }),
    );

    expect(result.dryRun).toBe(true);
    expect(result.status).toBe('replaced');

    const after = content(await callTool(userId, 'finance_doctrine_get', {}));
    expect(after.fingerprint).toBe(before.fingerprint);
    expect(after.doctrine?.coffeePatterns).toEqual(['test coffee']);
  });

  it('rejects a doctrine that does not match the shape', async () => {
    const bad: Record<string, unknown> = { ...doctrineFixture(), version: 2 };

    await expect(
      callTool(userId, 'finance_doctrine_import', { doctrine: bad, dryRun: false }),
    ).rejects.toThrow();
  });

  it('keeps each user isolated — another user has no doctrine and their import never touches ours', async () => {
    expect(content(await callTool(otherUserId, 'finance_doctrine_get', {})).doctrine).toBeNull();

    const result = content(
      await callTool(otherUserId, 'finance_doctrine_import', {
        doctrine: doctrineFixture(),
        dryRun: false,
      }),
    );
    expect(result.status).toBe('created');

    const other = content(await callTool(otherUserId, 'finance_doctrine_get', {}));
    const ours = content(await callTool(userId, 'finance_doctrine_get', {}));
    expect(other.fingerprint).not.toBe(ours.fingerprint);
    expect(other.doctrine?.merchantRules?.[0]?.note).toContain('Dated ruling');
    // Our row kept its own fingerprint — uniqueness is per user, not global.
    expect(ours.doctrine?.merchantRules).toHaveLength(3);
  });
});
