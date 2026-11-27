import { randomUUID } from 'node:crypto';

import { test } from 'vitest';

import { removeUsers, seedUser } from './factory';

export interface FinanceIntegrationFixture {
  ownerId: string;
  otherUserId: string;
}

/** Two fresh users per test, torn down with everything they own. */
export const financeIntegrationTest = test.extend<{ financeFixture: FinanceIntegrationFixture }>({
  financeFixture: async ({ task: _task }, use) => {
    const fixture = { ownerId: randomUUID(), otherUserId: randomUUID() };

    await seedUser({ id: fixture.ownerId, name: 'Finance Integration Owner' });
    await seedUser({ id: fixture.otherUserId, name: 'Finance Integration Other User' });

    try {
      await use(fixture);
    } finally {
      await removeUsers(fixture.ownerId, fixture.otherUserId);
    }
  },
});
