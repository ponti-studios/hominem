import { createHash } from 'node:crypto';

import { db, pool } from '@hominem/db/core';

const SEED = 'hominem-finance-demo-v1';
const DATABASE_URL = process.env.DATABASE_URL;
const USER_EMAIL = process.env.FINANCE_SEED_USER_EMAIL ?? 'test@lvh.me';
const ACCOUNT_COUNT = 10;
const TRANSACTION_COUNT = 1000;

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
const connection = new URL(DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(connection.hostname)) {
  throw new Error('Finance demo seeding is restricted to local PostgreSQL');
}
if (!['hominem', 'hominem-test'].includes(connection.pathname.slice(1))) {
  throw new Error('Finance demo seeding is restricted to hominem or hominem-test');
}

const accounts = [
  { name: 'Everyday Checking', type: 'depository', mask: '1042', currency: 'USD' },
  { name: 'High Yield Savings', type: 'depository', mask: '2288', currency: 'USD' },
  { name: 'Rewards Credit Card', type: 'credit', mask: '4419', currency: 'USD' },
  { name: 'Travel Card', type: 'credit', mask: '8803', currency: 'USD' },
  { name: 'Brokerage', type: 'investment', mask: '7301', currency: 'USD' },
  { name: 'Retirement 401(k)', type: 'investment', mask: '6117', currency: 'USD' },
  { name: 'Health Savings Account', type: 'depository', mask: '3820', currency: 'USD' },
  { name: 'Household Cash', type: 'cash', mask: '0001', currency: 'USD' },
  { name: 'Auto Loan', type: 'loan', mask: '5124', currency: 'USD' },
  { name: 'Side Business', type: 'depository', mask: '9026', currency: 'USD' },
] as const;

const categories = [
  'Income',
  'Housing',
  'Groceries',
  'Dining',
  'Transport',
  'Shopping',
  'Health',
  'Travel',
  'Entertainment',
  'Utilities',
  'Education',
  'Investments',
  'Transfers',
  'Subscriptions',
  'Gifts',
] as const;

const merchants = [
  ['Whole Foods', 'Trader Joe’s', 'Local Market', 'Costco', 'Farmers Market'],
  ['Blue Bottle Coffee', 'Neighborhood Cafe', 'Sweetgreen', 'Local Bistro', 'DoorDash'],
  ['Shell', 'Chevron', 'Metro Transit', 'Lyft', 'Parking Garage'],
  ['Netflix', 'Spotify', 'Apple Services', 'Cloud Storage', 'The New York Times'],
  ['Amazon', 'Target', 'IKEA', 'Bookshop', 'Hardware Store'],
  ['Electric Company', 'Water Utility', 'Internet Provider', 'Mobile Carrier'],
  ['Pharmacy', 'Dental Care', 'Health Clinic', 'Gym Membership'],
  ['Airline', 'Hotel', 'Rail Service', 'Car Rental', 'Museum'],
  ['Payroll', 'Client Invoice', 'Interest Payment', 'Cashback Reward'],
  ['Monthly Rent', 'Mortgage Servicer', 'Auto Finance', 'Student Loan Servicer'],
] as const;

function random(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function seedUuid(value: string): string {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const raw = hex.join('');
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

function dateFor(index: number, next: () => number): string {
  const day = new Date();
  day.setUTCHours(12, 0, 0, 0);
  day.setUTCDate(
    day.getUTCDate() - Math.floor((index / TRANSACTION_COUNT) * 730) - Math.floor(next() * 27),
  );
  return day.toISOString().slice(0, 10);
}

async function main() {
  const user = await db
    .selectFrom('user')
    .select(['id', 'email'])
    .where('email', '=', USER_EMAIL)
    .executeTakeFirst();
  if (!user) throw new Error(`No local user found for ${USER_EMAIL}; sign in first`);

  const ids: string[] = [];
  for (const [index, account] of accounts.entries()) {
    const importKey = `${SEED}:${index}`;
    const existing = await db
      .selectFrom('app.financeAccounts')
      .select('id')
      .where('userId', '=', user.id)
      .where('csvImportKey', '=', importKey)
      .executeTakeFirst();
    const id = existing?.id ?? seedUuid(`${user.id}:${importKey}`);
    await db
      .insertInto('app.financeAccounts')
      .values({
        id,
        userId: user.id,
        name: account.name,
        accountType: account.type,
        currencyCode: account.currency,
        mask: account.mask,
        provider: SEED,
        csvImportKey: importKey,
        metadata: { demoSeed: SEED },
      })
      .onConflict((conflict) =>
        conflict.column('id').doUpdateSet({
          name: account.name,
          accountType: account.type,
          currencyCode: account.currency,
          mask: account.mask,
          provider: SEED,
          metadata: { demoSeed: SEED },
        }),
      )
      .execute();
    ids.push(id);
  }

  const categoryIds = new Map<string, string>();
  for (const name of categories) {
    let row = await db
      .selectFrom('app.financeCategories')
      .select('id')
      .where('userId', '=', user.id)
      .where('name', '=', name)
      .executeTakeFirst();
    if (!row) {
      row = await db
        .insertInto('app.financeCategories')
        .values({ id: seedUuid(`${user.id}:${SEED}:category:${name}`), userId: user.id, name })
        .onConflict((conflict) => conflict.column('id').doNothing())
        .returning('id')
        .executeTakeFirst();
      row ??= await db
        .selectFrom('app.financeCategories')
        .select('id')
        .where('userId', '=', user.id)
        .where('name', '=', name)
        .executeTakeFirst();
    }
    if (!row) throw new Error(`Could not create category ${name}`);
    categoryIds.set(name, row.id);
  }

  const next = random(20261018);
  const today = new Date().toISOString().slice(0, 10);
  const rows = Array.from({ length: TRANSACTION_COUNT }, (_, index) => {
    const accountIndex = index % ACCOUNT_COUNT;
    const accountId = ids[accountIndex] ?? ids[0]!;
    const category = categories[Math.floor(next() * categories.length)] ?? 'Shopping';
    const merchantGroup = merchants[Math.floor(next() * merchants.length)] ?? merchants[0];
    const merchant = merchantGroup[Math.floor(next() * merchantGroup.length)] ?? 'Local Market';
    const periodic = index % 31 === 0;
    const transfer = category === 'Transfers';
    const income = category === 'Income' || (accountIndex === 9 && index % 3 === 0);
    const refund = !income && !transfer && index % 37 === 0;
    const pending = index % 83 === 0;
    const day = pending ? today : dateFor(index, next);
    const amountMagnitude = income
      ? 350 + next() * 5600
      : transfer
        ? 25 + next() * 1400
        : periodic
          ? 6 + next() * 220
          : 3 + next() * 490;
    const amount = Math.round(amountMagnitude * 100) / 100;
    const signedAmount = income || transfer || refund ? amount : -amount;
    const excluded = index % 47 === 0;
    const transactionType = transfer ? 'transfer' : income || refund ? 'credit' : 'debit';
    return {
      id: seedUuid(`${user.id}:${SEED}:transaction:${index}`),
      userId: user.id,
      accountId,
      amount: signedAmount,
      description: transfer
        ? index % 2
          ? 'Transfer to savings'
          : 'Transfer from savings'
        : merchant,
      merchantName: merchant,
      postedOn: day,
      transactionType,
      categoryId: categoryIds.get(category) ?? null,
      pending,
      excluded,
      recurring: periodic,
      source: SEED,
      externalId: `${SEED}:${index}`,
      notes: periodic ? 'Recurring demo transaction' : index % 19 === 0 ? 'Sample memo' : null,
      providerPayload: { demoSeed: SEED, category, refund },
    };
  });

  await db.transaction().execute(async (trx) => {
    await trx
      .deleteFrom('app.financeTransactions')
      .where('userId', '=', user.id)
      .where('source', '=', SEED)
      .execute();
    await trx.insertInto('app.financeTransactions').values(rows).execute();
  });

  const [accountCount, transactionCount] = await Promise.all([
    db
      .selectFrom('app.financeAccounts')
      .select((query) => query.fn.countAll<number>().as('count'))
      .where('userId', '=', user.id)
      .where('provider', '=', SEED)
      .executeTakeFirstOrThrow(),
    db
      .selectFrom('app.financeTransactions')
      .select((query) => query.fn.countAll<number>().as('count'))
      .where('userId', '=', user.id)
      .where('source', '=', SEED)
      .executeTakeFirstOrThrow(),
  ]);
  console.log(
    `Seeded ${Number(accountCount.count)} demo accounts and ${Number(transactionCount.count)} demo transactions for ${user.email} in ${connection.pathname.slice(1)}.`,
  );
}

try {
  await main();
} finally {
  await pool.end();
}
