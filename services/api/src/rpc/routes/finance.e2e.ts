import crypto from 'node:crypto';

import { db } from '@hominem/db';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { ForbiddenError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';

const FINANCE_TRANSACTION_ENTITY_TYPE = 'finance_transaction';

function deterministicUuid(userId: string, label: string): string {
  const hash = crypto.createHash('sha256').update(`${userId}:${label}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join('-');
}

const e2eGuard = createMiddleware<AppContext>(async (c, next) => {
  const enabled = process.env.NODE_ENV !== 'production' && process.env.AUTH_E2E_ENABLED === 'true';
  const expectedSecret = process.env.AUTH_E2E_SECRET;
  const providedSecret = c.req.header('x-e2e-auth-secret');

  if (!enabled || !expectedSecret || providedSecret !== expectedSecret) {
    throw new ForbiddenError('Finance E2E support is disabled');
  }

  return await next();
});

async function resetFinanceData(userId: string) {
  const [transactions, tags] = await Promise.all([
    db.selectFrom('finance_transactions').select('id').where('user_id', '=', userId).execute(),
    db.selectFrom('tags').select('id').where('owner_id', '=', userId).execute(),
  ]);

  const transactionIds = transactions.map((transaction) => transaction.id);
  const tagIds = tags.map((tag) => tag.id);

  if (transactionIds.length > 0) {
    await db
      .deleteFrom('tagged_items')
      .where('entity_type', '=', 'finance_transaction')
      .where('entity_id', 'in', transactionIds)
      .execute();
  }

  if (tagIds.length > 0) {
    await db.deleteFrom('tagged_items').where('tag_id', 'in', tagIds).execute();
  }

  await db.deleteFrom('finance_transactions').where('user_id', '=', userId).execute();
  await db.deleteFrom('finance_accounts').where('user_id', '=', userId).execute();
  await db.deleteFrom('plaid_items').where('user_id', '=', userId).execute();
  await db.deleteFrom('tags').where('owner_id', '=', userId).execute();
}

async function ensureE2eUser(user: NonNullable<AppContext['Variables']['user']>) {
  const now = new Date().toISOString();

  await db
    .insertInto('user')
    .values({
      id: user.id,
      email: user.email,
      emailVerified: true,
      name: user.name ?? 'Finance E2E User',
      image: user.image ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        email: user.email,
        emailVerified: true,
        name: user.name ?? 'Finance E2E User',
        image: user.image ?? null,
        updatedAt: now,
      }),
    )
    .execute();
}

async function seedFinanceData(userId: string) {
  await resetFinanceData(userId);

  const now = new Date('2026-01-31T12:00:00.000Z').toISOString();
  let institutionId = deterministicUuid(userId, 'institution-local-credit-union');
  const plaidItemId = deterministicUuid(userId, 'plaid-item-primary');
  const accounts = {
    checking: deterministicUuid(userId, 'account-everyday-checking'),
    credit: deterministicUuid(userId, 'account-travel-credit'),
    savings: deterministicUuid(userId, 'account-emergency-savings'),
  };
  const tags = {
    groceries: deterministicUuid(userId, 'tag-groceries'),
    rent: deterministicUuid(userId, 'tag-rent'),
    income: deterministicUuid(userId, 'tag-income'),
    travel: deterministicUuid(userId, 'tag-travel'),
  };
  const transactions = {
    salary: deterministicUuid(userId, 'transaction-salary-january'),
    rent: deterministicUuid(userId, 'transaction-rent-january'),
    groceries: deterministicUuid(userId, 'transaction-whole-foods'),
    cafe: deterministicUuid(userId, 'transaction-bridge-coffee'),
    flight: deterministicUuid(userId, 'transaction-atlas-air'),
    interest: deterministicUuid(userId, 'transaction-savings-interest'),
  };

  const existingInstitution = await db
    .selectFrom('financial_institutions')
    .select('id')
    .where('provider', '=', 'plaid')
    .where('provider_institution_id', '=', 'ins_e2e_local_credit_union')
    .executeTakeFirst();

  if (existingInstitution) {
    institutionId = existingInstitution.id;
  } else {
    await db
      .insertInto('financial_institutions')
      .values({
        id: institutionId,
        name: 'E2E Local Credit Union',
        provider: 'plaid',
        provider_institution_id: 'ins_e2e_local_credit_union',
        country_code: 'US',
        website_url: 'https://example.test/e2e-bank',
        logo_url: null,
      })
      .execute();
  }

  // The plaid_items table uses user_id, item_id (not provider_item_id), access_token, institution_id
  await db
    .insertInto('plaid_items')
    .values({
      id: plaidItemId,
      user_id: userId,
      item_id: `item-e2e-${userId.slice(0, 8)}`,
      access_token: `access-e2e-${userId.slice(0, 8)}`,
      institution_id: institutionId,
      cursor: 'cursor-e2e-seeded',
      status: 'healthy',
      last_synced_at: now,
      created_at: now,
      updated_at: now,
    })
    .execute();

  // The finance_accounts table uses user_id, balance (not current_balance), data (JSONB)
  await db
    .insertInto('finance_accounts')
    .values([
      {
        id: accounts.checking,
        user_id: userId,
        name: 'Everyday Checking',
        account_type: 'checking',
        balance: 2480.42,
        data: JSON.stringify({
          plaid_available_balance: 2400.42,
          plaid_account_id: 'plaid-checking-e2e',
          mask: '0001',
          currency_code: 'USD',
        }),
        plaid_item_id: plaidItemId,
        institution_id: institutionId,
        created_at: now,
        updated_at: now,
      },
      {
        id: accounts.credit,
        user_id: userId,
        name: 'Travel Credit',
        account_type: 'credit',
        balance: 742.1,
        data: JSON.stringify({
          plaid_available_balance: 0,
          plaid_account_id: 'plaid-credit-e2e',
          mask: '1010',
          currency_code: 'USD',
        }),
        plaid_item_id: plaidItemId,
        institution_id: institutionId,
        created_at: now,
        updated_at: now,
      },
      {
        id: accounts.savings,
        user_id: userId,
        name: 'Emergency Savings',
        account_type: 'savings',
        balance: 12000,
        data: null,
        plaid_item_id: null,
        institution_id: null,
        created_at: now,
        updated_at: now,
      },
    ])
    .execute();

  // The tags table uses owner_id (not owner_userid)
  await db
    .insertInto('tags')
    .values([
      {
        id: tags.groceries,
        owner_id: userId,
        name: 'Groceries',
        slug: 'finance-e2e-groceries',
        path: 'Groceries',
        color: '#3BAA7A',
        icon: 'shopping-basket',
      },
      {
        id: tags.rent,
        owner_id: userId,
        name: 'Rent',
        slug: 'finance-e2e-rent',
        path: 'Rent',
        color: '#D06A4A',
        icon: 'home',
      },
      {
        id: tags.income,
        owner_id: userId,
        name: 'Income',
        slug: 'finance-e2e-income',
        path: 'Income',
        color: '#5C8FCE',
        icon: 'wallet',
      },
      {
        id: tags.travel,
        owner_id: userId,
        name: 'Travel',
        slug: 'finance-e2e-travel',
        path: 'Travel',
        color: '#C58B40',
        icon: 'plane',
      },
    ])
    .execute();

  // finance_transactions uses user_id, date (not posted_on as required?), category
  await db
    .insertInto('finance_transactions')
    .values([
      {
        id: transactions.salary,
        user_id: userId,
        account_id: accounts.checking,
        amount: 5200,
        description: 'Ponti Studios Payroll',
        merchant_name: 'Ponti Studios',
        transaction_type: 'credit',
        source: 'e2e-seed',
        pending: false,
        posted_on: '2026-01-02T09:00:00.000Z',
        date: '2026-01-02T09:00:00.000Z',
        occurred_at: '2026-01-02T09:00:00.000Z',
        created_at: now,
        updated_at: now,
      },
      {
        id: transactions.rent,
        user_id: userId,
        account_id: accounts.checking,
        amount: -2200,
        description: 'January Studio Rent',
        merchant_name: 'Atlas Lofts',
        transaction_type: 'debit',
        source: 'e2e-seed',
        pending: false,
        posted_on: '2026-01-03T10:00:00.000Z',
        date: '2026-01-03T10:00:00.000Z',
        occurred_at: '2026-01-03T10:00:00.000Z',
        created_at: now,
        updated_at: now,
      },
      {
        id: transactions.groceries,
        user_id: userId,
        account_id: accounts.checking,
        amount: -86.42,
        description: 'Whole Foods Market',
        merchant_name: 'Whole Foods',
        transaction_type: 'debit',
        source: 'e2e-seed',
        pending: false,
        posted_on: '2026-01-12T18:30:00.000Z',
        date: '2026-01-12T18:30:00.000Z',
        occurred_at: '2026-01-12T18:30:00.000Z',
        created_at: now,
        updated_at: now,
      },
      {
        id: transactions.cafe,
        user_id: userId,
        account_id: accounts.checking,
        amount: -7.25,
        description: 'Bridge Coffee',
        merchant_name: 'Bridge Coffee',
        transaction_type: 'debit',
        source: 'e2e-seed',
        pending: false,
        posted_on: '2026-01-14T16:15:00.000Z',
        date: '2026-01-14T16:15:00.000Z',
        occurred_at: '2026-01-14T16:15:00.000Z',
        created_at: now,
        updated_at: now,
      },
      {
        id: transactions.flight,
        user_id: userId,
        account_id: accounts.credit,
        amount: -412.84,
        description: 'Atlas Air Flight',
        merchant_name: 'Atlas Air',
        transaction_type: 'debit',
        source: 'e2e-seed',
        pending: false,
        posted_on: '2026-01-18T13:45:00.000Z',
        date: '2026-01-18T13:45:00.000Z',
        occurred_at: '2026-01-18T13:45:00.000Z',
        created_at: now,
        updated_at: now,
      },
      {
        id: transactions.interest,
        user_id: userId,
        account_id: accounts.savings,
        amount: 18.05,
        description: 'Savings Interest',
        merchant_name: 'Emergency Savings',
        transaction_type: 'credit',
        source: 'e2e-seed',
        pending: false,
        posted_on: '2026-01-31T23:00:00.000Z',
        date: '2026-01-31T23:00:00.000Z',
        occurred_at: '2026-01-31T23:00:00.000Z',
        created_at: now,
        updated_at: now,
      },
    ])
    .execute();

  // tagged_items uses entity_type (string), not entity_table (regclass)
  const FINANCE_TRANSACTION_ENTITY_TYPE = 'finance_transaction';
  await db
    .insertInto('tagged_items')
    .values([
      {
        id: deterministicUuid(userId, 'assignment-salary-income'),
        tag_id: tags.income,
        entity_type: FINANCE_TRANSACTION_ENTITY_TYPE,
        entity_id: transactions.salary,
        assigned_by_userid: userId,
        assignment_source: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-rent'),
        tag_id: tags.rent,
        entity_type: FINANCE_TRANSACTION_ENTITY_TYPE,
        entity_id: transactions.rent,
        assigned_by_userid: userId,
        assignment_source: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-groceries'),
        tag_id: tags.groceries,
        entity_type: FINANCE_TRANSACTION_ENTITY_TYPE,
        entity_id: transactions.groceries,
        assigned_by_userid: userId,
        assignment_source: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-flight-travel'),
        tag_id: tags.travel,
        entity_type: FINANCE_TRANSACTION_ENTITY_TYPE,
        entity_id: transactions.flight,
        assigned_by_userid: userId,
        assignment_source: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-interest-income'),
        tag_id: tags.income,
        entity_type: FINANCE_TRANSACTION_ENTITY_TYPE,
        entity_id: transactions.interest,
        assigned_by_userid: userId,
        assignment_source: 'import',
        confidence: 1,
      },
    ])
    .execute();

  return {
    userId,
    institutionId,
    plaidItemId,
    accounts,
    tags,
    transactions,
  };
}

export const financeE2eRoutes = new Hono<AppContext>()
  .use('*', e2eGuard, authMiddleware)
  .post('/reset', async (c) => {
    const userId = c.get('userId')!;
    const user = c.get('user')!;
    await ensureE2eUser(user);
    await resetFinanceData(userId);
    return c.json({ ok: true, userId });
  })
  .post('/seed', async (c) => {
    const userId = c.get('userId')!;
    const user = c.get('user')!;
    await ensureE2eUser(user);
    const seed = await seedFinanceData(userId);
    return c.json({ ok: true, ...seed });
  });
