import crypto from 'node:crypto';

import { db } from '@hominem/db';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';

import { ForbiddenError } from '../errors';
import { authMiddleware, type AppContext } from '../middleware/auth';


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
    db.selectFrom('app.financeTransactions').select('id').where('userId', '=', userId).execute(),
    db.selectFrom('app.tags').select('id').where('ownerUserid', '=', userId).execute(),
  ]);

  const transactionIds = transactions.map((transaction) => transaction.id);
  const tagIds = tags.map((tag) => tag.id);

  if (transactionIds.length > 0) {
    await db
      .deleteFrom('app.tagAssignments')
      .where('entityTable', '=', 'finance_transaction')
      .where('entityId', 'in', transactionIds)
      .execute();
  }

  if (tagIds.length > 0) {
    await db.deleteFrom('app.tagAssignments').where('tagId', 'in', tagIds).execute();
  }

  await db.deleteFrom('app.financeTransactions').where('userId', '=', userId).execute();
  await db.deleteFrom('app.financeAccounts').where('userId', '=', userId).execute();
  await db.deleteFrom('app.plaidItems').where('userId', '=', userId).execute();
  await db.deleteFrom('app.tags').where('ownerUserid', '=', userId).execute();
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
    .selectFrom('app.financeInstitutions')
    .select('id')
    .where('provider', '=', 'plaid')
    .where('providerInstitutionId', '=', 'ins_e2e_local_credit_union')
    .executeTakeFirst();

  if (existingInstitution) {
    institutionId = existingInstitution.id;
  } else {
    await db
      .insertInto('app.financeInstitutions')
      .values({
        id: institutionId,
        name: 'E2E Local Credit Union',
        provider: 'plaid',
        providerInstitutionId: 'ins_e2e_local_credit_union',
        countryCode: 'US',
        websiteUrl: 'https://example.test/e2e-bank',
        logoUrl: null,
      })
      .execute();
  }

  // The plaid_items table uses user_id, item_id (not provider_item_id), access_token, institution_id
  await db
    .insertInto('app.plaidItems')
    .values({
      id: plaidItemId,
      userId: userId,
      providerItemId: `item-e2e-${userId.slice(0, 8)}`,
      accessToken: `access-e2e-${userId.slice(0, 8)}`,
      institutionId: institutionId,
      cursor: 'cursor-e2e-seeded',
      status: 'healthy',
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  // The finance_accounts table uses user_id, balance (not current_balance), data (JSONB)
  await db
    .insertInto('app.financeAccounts')
    .values([
      {
        id: accounts.checking,
        userId: userId,
        name: 'Everyday Checking',
        accountType: 'checking',
        currentBalance: 2480.42,
        metadata: JSON.stringify({
          plaid_available_currentBalance: 2400.42,
          plaid_accountId: 'plaid-checking-e2e',
          mask: '0001',
          currency_code: 'USD',
        }),
        plaidAccountId: plaidItemId,
        institutionId: institutionId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: accounts.credit,
        userId: userId,
        name: 'Travel Credit',
        accountType: 'credit',
        currentBalance: 742.1,
        metadata: JSON.stringify({
          plaid_available_currentBalance: 0,
          plaid_accountId: 'plaid-credit-e2e',
          mask: '1010',
          currency_code: 'USD',
        }),
        plaidAccountId: plaidItemId,
        institutionId: institutionId,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: accounts.savings,
        userId: userId,
        name: 'Emergency Savings',
        accountType: 'savings',
        currentBalance: 12000,
        metadata: null,
        plaidAccountId: null,
        institutionId: null,
        createdAt: now,
        updatedAt: now,
      },
    ])
    .execute();

  // The tags table uses owner_id (not owner_userid)
  await db
    .insertInto('app.tags')
    .values([
      {
        id: tags.groceries,
        ownerUserid: userId,
        name: 'Groceries',
        slug: 'finance-e2e-groceries',
        path: 'Groceries',
        color: '#3BAA7A',
        icon: 'shopping-basket',
      },
      {
        id: tags.rent,
        ownerUserid: userId,
        name: 'Rent',
        slug: 'finance-e2e-rent',
        path: 'Rent',
        color: '#D06A4A',
        icon: 'home',
      },
      {
        id: tags.income,
        ownerUserid: userId,
        name: 'Income',
        slug: 'finance-e2e-income',
        path: 'Income',
        color: '#5C8FCE',
        icon: 'wallet',
      },
      {
        id: tags.travel,
        ownerUserid: userId,
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
    .insertInto('app.financeTransactions')
    .values([
      {
        id: transactions.salary,
        userId: userId,
        accountId: accounts.checking,
        amount: 5200,
        description: 'Ponti Studios Payroll',
        merchantName: 'Ponti Studios',
        transactionType: 'credit',
        source: 'e2e-seed',
        pending: false,
        postedOn: '2026-01-02T09:00:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: transactions.rent,
        userId: userId,
        accountId: accounts.checking,
        amount: -2200,
        description: 'January Studio Rent',
        merchantName: 'Atlas Lofts',
        transactionType: 'debit',
        source: 'e2e-seed',
        pending: false,
        postedOn: '2026-01-03T10:00:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: transactions.groceries,
        userId: userId,
        accountId: accounts.checking,
        amount: -86.42,
        description: 'Whole Foods Market',
        merchantName: 'Whole Foods',
        transactionType: 'debit',
        source: 'e2e-seed',
        postedOn: '2026-01-12T18:30:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: transactions.cafe,
        userId: userId,
        accountId: accounts.checking,
        amount: -7.25,
        description: 'Bridge Coffee',
        merchantName: 'Bridge Coffee',
        transactionType: 'debit',
        pending: false,
        postedOn: '2026-01-14T16:15:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: transactions.flight,
        userId: userId,
        accountId: accounts.credit,
        amount: -412.84,
        description: 'Atlas Air Flight',
        merchantName: 'Atlas Air',
        transactionType: 'debit',
        source: 'e2e-seed',
        pending: false,
        postedOn: '2026-01-18T13:45:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: transactions.interest,
        userId: userId,
        accountId: accounts.savings,
        amount: 18.05,
        description: 'Savings Interest',
        transactionType: 'credit',
        source: 'e2e-seed',
        pending: false,
        postedOn: '2026-01-31T23:00:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
    ])
    .execute();

  // tagged_items uses entity_type (string), not entity_table (regclass)
  await db
    .insertInto('app.tagAssignments')
    .values([
      {
        id: deterministicUuid(userId, 'assignment-salary-income'),
        tagId: tags.income,
        entityId: transactions.salary,
        entityTable: 'app.financeTransactions',
        assignedByUserid: userId,
        assignmentSource: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-rent'),
        tagId: tags.rent,
        entityId: transactions.rent,
        entityTable: 'app.financeTransactions',
        assignedByUserid: userId,
        assignmentSource: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-groceries'),
        tagId: tags.groceries,
        entityId: transactions.groceries,
        entityTable: 'app.financeTransactions',
        assignedByUserid: userId,
        assignmentSource: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-flight-travel'),
        tagId: tags.travel,
        entityId: transactions.flight,
        entityTable: 'app.financeTransactions',
        assignedByUserid: userId,
        assignmentSource: 'import',
        confidence: 1,
      },
      {
        id: deterministicUuid(userId, 'assignment-interest-income'),
        tagId: tags.income,
        entityId: transactions.interest,
        entityTable: 'app.financeTransactions',
        assignedByUserid: userId,
        assignmentSource: 'import',
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
