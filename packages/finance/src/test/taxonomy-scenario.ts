import { randomUUID } from 'node:crypto';

import { createOrGetFinanceCategory } from '../sheet-import';
import { seedAccount, seedTransactions } from './factory';

export interface Fixture {
  ownerId: string;
  accountId: string;
  categories: Record<'coffee' | 'food' | 'groceries' | 'restaurants', { id: string; name: string }>;
  transactions: Record<'coffee' | 'food' | 'groceries' | 'restaurants', string[]>;
}

// Placeholder taxonomy only: a bucket and three components that are folded into it.
const ROWS = [
  { key: 'groceries', amount: -25.5, postedOn: '2026-05-01', description: 'Grocery row one' },
  { key: 'groceries', amount: -10, postedOn: '2026-05-02', description: 'Grocery row two' },
  {
    key: 'restaurants',
    amount: -40,
    currencyCode: 'EUR',
    postedOn: '2026-05-03',
    description: 'Restaurant row',
  },
  { key: 'coffee', amount: -3.5, postedOn: '2026-05-04', description: 'Coffee row' },
  {
    key: 'food',
    amount: -5,
    postedOn: '2026-05-05',
    description: 'Food row already in the target',
  },
] as const;

export async function seedTaxonomyScenario(ownerId: string): Promise<Fixture> {
  const { id: accountId } = await seedAccount({
    userId: ownerId,
    name: 'Taxonomy Checking',
    currencyCode: 'USD',
  });

  const named = async (name: string) => {
    const category = await createOrGetFinanceCategory(ownerId, name);
    return { id: category.id!, name };
  };
  const categories = {
    groceries: await named('Groceries'),
    restaurants: await named('Restaurants'),
    coffee: await named('Coffee'),
    food: await named('Food'),
  };

  const rows = ROWS.map(({ key, ...row }) => ({ ...row, key, id: randomUUID() }));
  await seedTransactions(
    ownerId,
    rows.map(({ key, ...row }) => ({
      currencyCode: 'USD',
      ...row,
      accountId,
      categoryId: categories[key].id,
      externalId: row.id,
    })),
  );

  const idsFor = (key: keyof typeof categories) =>
    rows.filter((row) => row.key === key).map((row) => row.id);
  return {
    ownerId,
    accountId,
    categories,
    transactions: {
      groceries: idsFor('groceries'),
      restaurants: idsFor('restaurants'),
      coffee: idsFor('coffee'),
      food: idsFor('food'),
    },
  };
}
