import type { AuthUser as User } from '@ponti-studios/auth/types';
import { useCallback } from 'react';

import { authClient } from '~/services/auth/auth-client';

// HominemAuth returns the updated user so the provider can update its session.
export async function updateProfile(updates: Partial<User>) {
  const result = await authClient.updateUser({
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.image !== undefined ? { image: updates.image } : {}),
  });

  return result;
}

export function useUpdateProfile() {
  return useCallback((updates: Partial<User>) => updateProfile(updates), []);
}
