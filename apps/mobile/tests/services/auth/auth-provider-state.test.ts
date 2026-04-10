import { describe, expect, it } from 'vitest';

import { createAuthContextSnapshot, mapAuthUser } from '~/services/auth/auth-provider-state';

describe('mapAuthUser', () => {
  it('maps the auth user shape into the public user shape', () => {
    expect(
      mapAuthUser({
        id: 'user-1',
        email: 'user@example.com',
        name: 'User',
        image: 'https://example.com/avatar.png',
        emailVerified: true,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
      }),
    ).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      image: 'https://example.com/avatar.png',
      emailVerified: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    });
  });
});

describe('createAuthContextSnapshot', () => {
  it('derives loading and sign-in state from auth state', () => {
    expect(
      createAuthContextSnapshot({
        status: 'booting',
        isLoading: false,
        error: null,
        user: null,
      } as never),
    ).toMatchObject({
      authStatus: 'booting',
      isLoadingAuth: true,
      isSignedIn: false,
      currentUser: null,
    });

    expect(
      createAuthContextSnapshot({
        status: 'signed_in',
        isLoading: false,
        error: null,
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: null,
          image: null,
          emailVerified: false,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-02T00:00:00.000Z'),
        },
      } as never),
    ).toMatchObject({
      authStatus: 'signed_in',
      isLoadingAuth: false,
      isSignedIn: true,
      currentUser: {
        id: 'user-1',
        email: 'user@example.com',
      },
    });
  });
});
