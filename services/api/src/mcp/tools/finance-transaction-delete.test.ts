import { removeUsers, resetUsers, seedAccounts } from '@hominem/finance-services/test/factory';
import { transactionsByIds } from '@hominem/finance-services/test/readers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { upsertTransaction } from '../../testkit/fixtures/finance-tool-calls';
import { structuredContent } from '../../testkit/fixtures/mcp-content';
import { callTool, getToolDefinition } from '../tool-registry';
import './finance';

const userId = 'f20000c0-0000-4000-8000-000000000001';
const otherUserId = 'f20000c0-0000-4000-8000-000000000002';
const checkingId = 'f20000c1-0000-4000-8000-000000000001';
const otherCheckingId = 'f20000c1-0000-4000-8000-000000000002';

type Content = {
  id?: string | null;
  deleted?: Array<{
    id: string;
    description: string | null;
    amountCents: number;
    currencyCode: string;
  }>;
  notFound?: string[];
  accounts?: Array<{ accountId: string; transactionCount: number }>;
};

const content = structuredContent<Content>;

beforeAll(async () => {
  await resetUsers(userId, otherUserId);
  await seedAccounts(userId, [
    { id: checkingId, name: 'Delete Checking' },
    { id: otherCheckingId, userId: otherUserId, name: 'Other Checking' },
  ]);
});

afterAll(() => removeUsers(userId, otherUserId));

describe('finance_transaction_delete', () => {
  it('uses the explicit confirmation flag instead of elicitation', async () => {
    const preview = getToolDefinition('finance_transaction_delete')?.preview;
    expect(preview).toBeTypeOf('function');
    await expect(preview?.(userId, { ids: [] })).resolves.toBeNull();
  });

  it('refuses without iUnderstand and leaves the row intact', async () => {
    const id =
      (
        await upsertTransaction<Content>(userId, {
          account: 'Delete Checking',
          description: 'Delete Probe A',
          postedOn: '2026-05-01',
          amountCents: -1234,
        })
      ).id ?? '';
    await expect(callTool(userId, 'finance_transaction_delete', { ids: [id] })).rejects.toThrow(
      /confirmation_required/,
    );
    const rows = await transactionsByIds([id]);
    expect(rows).toHaveLength(1);
  });

  it('deletes with iUnderstand, snapshots the row and drops the account count', async () => {
    const id =
      (
        await upsertTransaction<Content>(userId, {
          account: 'Delete Checking',
          description: 'Delete Probe B',
          postedOn: '2026-05-01',
          amountCents: -1234,
        })
      ).id ?? '';
    const before = content(
      await callTool(userId, 'finance_account_summary', { accountId: checkingId }),
    );

    const result = content(
      await callTool(userId, 'finance_transaction_delete', { ids: [id], iUnderstand: true }),
    );
    expect(result.notFound).toEqual([]);
    expect(result.deleted).toHaveLength(1);
    expect(result.deleted?.[0]).toMatchObject({
      id,
      description: 'Delete Probe B',
      amount: -12.34,
      currencyCode: 'USD',
    });

    const rows = await transactionsByIds([id]);
    expect(rows).toHaveLength(0);

    const after = content(
      await callTool(userId, 'finance_account_summary', { accountId: checkingId }),
    );
    const beforeCount = before.accounts?.[0]?.transactionCount ?? 0;
    expect(after.accounts?.[0]?.transactionCount).toBe(beforeCount - 1);
  });

  it('reports a re-delete as notFound, never as an error', async () => {
    const id =
      (
        await upsertTransaction<Content>(userId, {
          account: 'Delete Checking',
          description: 'Delete Probe C',
          postedOn: '2026-05-01',
          amountCents: -1234,
        })
      ).id ?? '';
    await callTool(userId, 'finance_transaction_delete', { ids: [id], iUnderstand: true });

    const again = content(
      await callTool(userId, 'finance_transaction_delete', { ids: [id], iUnderstand: true }),
    );
    expect(again.deleted).toEqual([]);
    expect(again.notFound).toEqual([id]);
  });

  it("never deletes another user's transaction", async () => {
    const otherId =
      (
        await upsertTransaction<Content>(otherUserId, {
          account: 'Other Checking',
          description: 'Delete Probe D',
          postedOn: '2026-05-01',
          amountCents: -1234,
        })
      ).id ?? '';
    const result = content(
      await callTool(userId, 'finance_transaction_delete', { ids: [otherId], iUnderstand: true }),
    );
    expect(result.notFound).toEqual([otherId]);

    const rows = await transactionsByIds([otherId]);
    expect(rows).toHaveLength(1);
  });
});
