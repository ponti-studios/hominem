import { db, pool } from '@hominem/db/core';

import { seedBudgetsOfRecord } from '../src/application/finance-budgets.service';

// Seeds the budgets of record for one user: Groceries 25000 cents monthly and Dining Out
// 30000 cents monthly. Category-level only — there are no tag or merchant budgets.
const DATABASE_URL = process.env.DATABASE_URL;
const USER_EMAIL = process.env.BUDGET_SEED_USER_EMAIL ?? 'test@lvh.me';
const PRIMARY_CURRENCY = process.env.BUDGET_SEED_PRIMARY_CURRENCY ?? 'GBP';

if (!DATABASE_URL) throw new Error('DATABASE_URL is required');
const connection = new URL(DATABASE_URL);
if (!['localhost', '127.0.0.1', '::1'].includes(connection.hostname)) {
  throw new Error('Budget seeding is restricted to local PostgreSQL');
}
if (!['hominem', 'hominem-test'].includes(connection.pathname.slice(1))) {
  throw new Error('Budget seeding is restricted to hominem or hominem-test');
}

const user = await db
  .selectFrom('user')
  .select(['id', 'email'])
  .where('email', '=', USER_EMAIL)
  .executeTakeFirst();
if (!user) throw new Error(`No user with email ${USER_EMAIL}; create it first.`);

const result = await seedBudgetsOfRecord(user.id, PRIMARY_CURRENCY);
console.info(`Seeded budgets for ${user.email}: ${JSON.stringify(result)}`);
await pool.end();
