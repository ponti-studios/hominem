import type { User } from '@hakumi/auth/types';

import type { AuthState } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/sqlite';

interface SignInUser {
  id: string;
  email: string;
  name?: string | null;
}

function fromSignInUser(user: SignInUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? '',
    image: null,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

export async function upsertBootProfile(user: SignInUser): Promise<NonNullable<AuthState['user']> | null> {
  return LocalStore.upsertUserProfile(fromSignInUser(user));
}
