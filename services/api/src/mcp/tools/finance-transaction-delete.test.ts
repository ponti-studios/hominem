import { db, pool } from '@hominem/db/core';
import { beforeAll, describe, expect, it } from 'vitest';

import { callTool, getToolDefinition, type McpToolResult } from '../tool-registry';
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

function content(res: McpToolResult<Content>): Content {
  return res.structuredContent ?? {};
}

beforeAll(async () => {
  for (const id of [userId, otherUserId]) {
    await pool.query(
      `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [id, `Delete User ${id}`, `${id}@test.hominem.dev`, true],
    );
    await db.deleteFrom('app.financeAccounts').where('userId', '=', id).execute();
  }

  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: checkingId,
        userId,
        name: 'Delete Checking',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
      {
        id: otherCheckingId,
        userId: otherUserId,
        name: 'Other Checking',
        accountType: 'checking',
        currencyCode: 'USD',
        lifecycleStatus: 'open',
        includeInNetWorth: true,
        metadata: {},
      },
    ])
    .execute();
});

async function upsertProbe(owner: string, account: string, description: string): Promise<string> {
  const result = await callTool(owner, 'finance_transaction_upsert', {
    postedOn: '2026-05-01',
    account,
    description,
    amountCents: -1234,
    currencyCode: 'USD',
  });
  return content(result).id ?? '';
}

describe('finance_transaction_delete', () => {
  it('uses the explicit confirmation flag instead of elicitation', async () => {
    const preview = getToolDefinition('finance_transaction_delete')?.preview;
    expect(preview).toBeTypeOf('function');
    await expect(preview?.(userId, { ids: [] })).resolves.toBeNull();
  });

  it('refuses without iUnderstand and leaves the row intact', async () => {
    const id = await upsertProbe(userId, 'Delete Checking', 'Delete Probe A');
    await expect(callTool(userId, 'finance_transaction_delete', { ids: [id] })).rejects.toThrow(
      /confirmation_required/,
    );
    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('id', '=', id)
      .execute();
    expect(rows).toHaveLength(1);
  });

  it('deletes with iUnderstand, snapshots the row and drops the account count', async () => {
    const id = await upsertProbe(userId, 'Delete Checking', 'Delete Probe B');
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
      amountCents: -1234,
      currencyCode: 'USD',
    });

    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('id', '=', id)
      .execute();
    expect(rows).toHaveLength(0);

    const after = content(
      await callTool(userId, 'finance_account_summary', { accountId: checkingId }),
    );
    const beforeCount = before.accounts?.[0]?.transactionCount ?? 0;
    expect(after.accounts?.[0]?.transactionCount).toBe(beforeCount - 1);
  });

  it('reports a re-delete as notFound, never as an error', async () => {
    const id = await upsertProbe(userId, 'Delete Checking', 'Delete Probe C');
    await callTool(userId, 'finance_transaction_delete', { ids: [id], iUnderstand: true });

    const again = content(
      await callTool(userId, 'finance_transaction_delete', { ids: [id], iUnderstand: true }),
    );
    expect(again.deleted).toEqual([]);
    expect(again.notFound).toEqual([id]);
  });

  it("never deletes another user's transaction", async () => {
    const otherId = await upsertProbe(otherUserId, 'Other Checking', 'Delete Probe D');
    const result = content(
      await callTool(userId, 'finance_transaction_delete', { ids: [otherId], iUnderstand: true }),
    );
    expect(result.notFound).toEqual([otherId]);

    const rows = await db
      .selectFrom('app.financeTransactions')
      .select('id')
      .where('id', '=', otherId)
      .execute();
    expect(rows).toHaveLength(1);
  });
});
