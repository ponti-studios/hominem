import type { User } from '@hominem/auth/types';
import { useCallback } from 'react';

import type { AuthContext } from '~/services/auth/types';
import { LocalStore } from '~/services/storage/sqlite';

export async function saveUpdatedProfile(input: {
  current: User | null;
  updates: Partial<User>;
  dispatch: AuthContext['dispatch'];
  persist: (profile: User) => Promise<User>;
}): Promise<User> {
  const { current, updates, dispatch, persist } = input;

  if (!current) throw new Error('No user profile to update');

  const merged: User = {
    ...current,
    ...updates,
    updatedAt: new Date(),
  };

  const saved = await persist(merged);
  if (!saved) throw new Error('Failed to update profile');

  dispatch({ type: 'SESSION_LOADED', user: saved });
  return saved;
}

export function useUpdateProfile(context: AuthContext) {
  const { dispatch } = context;

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      const current = await LocalStore.getUserProfile();
      return saveUpdatedProfile({
        current,
        updates,
        dispatch,
        persist: LocalStore.upsertUserProfile,
      });
    },
    [dispatch],
  );

  return updateProfile;
}
