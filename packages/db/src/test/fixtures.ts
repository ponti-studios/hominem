// Test fixtures using Kysely

export const createTestUser = async (
  overrides: { id?: string; email?: string; name?: string } = {},
) => {
  const { authDb } = await import('../db');
  const id = overrides.id || `test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const user = {
    id,
    email: overrides.email || `test-${id}@example.com`,
    name: overrides.name || 'Test User',
  };

  await authDb.insertInto('user').values(user).execute();

  return user;
};
