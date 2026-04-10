import type { User } from '@hominem/auth';
import { useCallback } from 'react';

import { LocalStore } from '~/services/storage/sqlite';

export function useUpdateProfile() {
  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const current = await LocalStore.getUserProfile();
    if (!current) throw new Error('No user profile to update');

    const merged: User = {
      ...current,
      ...updates,
      updatedAt: new Date(),
    };

    const saved = await LocalStore.upsertUserProfile(merged);
    if (!saved) throw new Error('Failed to update profile');

    return saved;
  }, []);

  return updateProfile;
}