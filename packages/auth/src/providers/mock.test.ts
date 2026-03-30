import { describe, expect, it } from 'vitest';

import { DEFAULT_MOCK_USER, MOCK_USERS } from '../mock-users';
import { createMockAuthProvider } from '../providers/mock';

describe('MockAuthProvider', () => {
  it('signs in as the selected mock identity', async () => {
    const provider = createMockAuthProvider('tester');

    await expect(provider.signIn()).resolves.toMatchObject({
      user: {
        id: MOCK_USERS.tester.id,
        email: MOCK_USERS.tester.email,
      },
    });
  });

  it('switches mock identities for subsequent sign-ins and rejects unknown users', async () => {
    const provider = createMockAuthProvider();

    expect(provider.getCurrentUser().id).toBe(DEFAULT_MOCK_USER.id);

    provider.switchUser('tester');
    await expect(provider.signIn()).resolves.toMatchObject({
      user: {
        id: MOCK_USERS.tester.id,
        email: MOCK_USERS.tester.email,
      },
    });

    expect(() => provider.switchUser('missing-user')).toThrow("Mock user 'missing-user' not found");
  });
});
