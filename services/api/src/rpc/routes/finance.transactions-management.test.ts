import { pool } from '@hominem/db/core';
import { Hono } from 'hono';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { requestIdMiddleware, type AppContext, type RpcUser } from '../middleware/auth';
import { apiErrorHandler } from '../middleware/error';
import { validationErrorMiddleware } from '../middleware/validation';
import { transactionsRoutes } from './finance.transactions';

const userId = 'b4010001-0000-4000-8000-000000000001';
const accountA = 'b4010003-0000-4000-8000-000000000001';
const accountB = 'b4010003-0000-4000-8000-000000000002';
const categoryId = 'b4010005-0000-4000-8000-000000000001';
const expenseId = 'b4010006-0000-4000-8000-000000000001';
const incomeId = 'b4010006-0000-4000-8000-000000000002';

const user: RpcUser = {
  id: userId,
  email: `${userId}@test.dev`,
  name: 'Finance Transactions Test User',
  emailVerified: true,
  image: null,
  isAdmin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const app = new Hono<AppContext>()
  .onError(apiErrorHandler)
  .use(requestIdMiddleware)
  .use(validationErrorMiddleware)
  .use('*', async (c, next) => {
    c.set('auth', { user, userId, credential: 'session', scopes: [] });
    await next();
  })
  .route('/api/finance/transactions', transactionsRoutes);

async function request(path: string, body: unknown) {
  return app.request(`/api/finance/transactions/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function clearFixture() {
  await pool.query(`DELETE FROM app.finance_transactions WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM app.finance_categories WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM app.finance_accounts WHERE user_id = $1`, [userId]);
  await pool.query(`DELETE FROM "user" WHERE id = $1`, [userId]);
}

beforeAll(async () => {
  await clearFixture();
  await pool.query(
    `INSERT INTO "user" (id, name, email, "emailVerified") VALUES ($1, $2, $3, true)`,
    [userId, user.name, user.email],
  );
  await pool.query(
    `INSERT INTO app.finance_accounts (id, user_id, name, account_type, currency_code)
     VALUES ($1, $3, 'Checking', 'checking', 'USD'), ($2, $3, 'Savings', 'checking', 'USD')`,
    [accountA, accountB, userId],
  );
  await pool.query(
    `INSERT INTO app.finance_categories (id, user_id, name) VALUES ($1, $2, 'Dining')`,
    [categoryId, userId],
  );
  await pool.query(
    `INSERT INTO app.finance_transactions
       (id, user_id, account_id, amount, transaction_type, description, merchant_name, posted_on, currency_code)
     VALUES
       ($1, $3, $4, -20, 'debit', 'Coffee Shop', 'Coffee Shop', '2026-11-10', 'USD'),
       ($2, $3, $5, 20, 'credit', 'Transfer from Checking', 'Coffee Shop', '2026-11-10', 'USD')`,
    [expenseId, incomeId, userId, accountA, accountB],
  );
});

afterAll(clearFixture);

describe('finance transaction management', () => {
  it('saves selected categories immediately and learns suggestion-only merchant rules', async () => {
    const response = await request('batch', {
      ids: [expenseId],
      action: { action: 'category', categoryId },
    });
    expect(response.status).toBe(200);

    const category = await pool.query<{ category_id: string }>(
      `SELECT category_id FROM app.finance_transactions WHERE id = $1 AND user_id = $2`,
      [expenseId, userId],
    );
    expect(category.rows[0]?.category_id).toBe(categoryId);

    const rulebook = await pool.query<{
      contents: { merchantRules: Array<{ merchant: string; category: string }> };
    }>(
      `SELECT contents FROM app.finance_ruling_rulebooks
       WHERE user_id = $1 AND source = 'live' ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    expect(rulebook.rows[0]?.contents.merchantRules).toContainEqual({
      merchant: 'Coffee Shop',
      category: 'Dining',
      tags: [],
    });
  });

  it('links matching transactions and restores their original types when unlinked', async () => {
    const linked = await request('transfer/pair', { ids: [expenseId, incomeId] });
    expect(linked.status).toBe(200);
    const pair = await pool.query<{
      id: string;
      counterpart_id: string | null;
      transaction_type: string;
    }>(
      `SELECT id, counterpart_id, transaction_type FROM app.finance_transactions WHERE id = ANY($1) ORDER BY id`,
      [[expenseId, incomeId]],
    );
    expect(pair.rows).toEqual([
      { id: expenseId, counterpart_id: incomeId, transaction_type: 'transfer' },
      { id: incomeId, counterpart_id: expenseId, transaction_type: 'transfer' },
    ]);

    const unlinked = await request('transfer/unlink', { id: expenseId });
    expect(unlinked.status).toBe(200);
    const restored = await pool.query<{
      id: string;
      counterpart_id: string | null;
      transaction_type: string;
    }>(
      `SELECT id, counterpart_id, transaction_type FROM app.finance_transactions WHERE id = ANY($1) ORDER BY id`,
      [[expenseId, incomeId]],
    );
    expect(restored.rows).toEqual([
      { id: expenseId, counterpart_id: null, transaction_type: 'debit' },
      { id: incomeId, counterpart_id: null, transaction_type: 'credit' },
    ]);
  });

  it('updates transaction details using the stored debit and credit types', async () => {
    const response = await request('update', {
      id: expenseId,
      data: { amount: -25, merchantName: 'Coffee Shop', date: '2026-11-11' },
    });
    expect(response.status).toBe(200);
    const updated = await pool.query<{ amount: number; transaction_type: string }>(
      `SELECT amount, transaction_type FROM app.finance_transactions WHERE id = $1 AND user_id = $2`,
      [expenseId, userId],
    );
    expect(updated.rows[0]).toEqual({ amount: -25, transaction_type: 'debit' });
  });
});
