import { randomUUID } from 'node:crypto';

// Kysely-compatible test utilities

export const isIntegrationDatabaseAvailable = async (): Promise<boolean> => {
  try {
    const { pool } = await import('../db');
    const result = await pool.query('SELECT 1');
    return result.rowCount === 1;
  } catch {
    return false;
  }
};

export const createDeterministicIdFactory = (prefix: string) => {
  void prefix;
  let counter = 0;
  return () => {
    counter += 1;
    return randomUUID();
  };
};

// Create users with specific IDs (for tests that need deterministic IDs)
export const ensureIntegrationUsers = async (
  users: Array<{ id: string; name: string; email?: string }>,
): Promise<{ ownerId: string; otherUserId: string }> => {
  const { db } = await import('../db');

  for (const user of users) {
    await db
      .insertInto('user')
      .values({
        id: user.id,
        email: user.email ?? `${user.id}@test.com`,
        name: user.name,
      })
      .execute();
  }

  return { ownerId: users[0]?.id || '', otherUserId: users[1]?.id || '' };
};
