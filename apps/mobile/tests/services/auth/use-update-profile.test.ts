import type { User } from '@hominem/auth/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('~/services/storage/local-store', () => ({
  LocalStore: {},
}));

import { saveUpdatedProfile } from '~/services/auth/hooks/use-update-profile';

describe('saveUpdatedProfile', () => {
  it('persists the merged profile and refreshes auth state', async () => {
    const current: User = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'Old Name',
      image: null,
      emailVerified: true,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    };
    const saved: User = {
      ...current,
      name: 'New Name',
      updatedAt: new Date('2024-02-01T00:00:00.000Z'),
    };
    const persist = vi.fn().mockResolvedValue(saved);
    const dispatch = vi.fn();

    await expect(
      saveUpdatedProfile({
        current,
        updates: { name: 'New Name' },
        dispatch,
        persist,
      }),
    ).resolves.toEqual(saved);

    expect(persist).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        name: 'New Name',
        email: 'user@example.com',
        updatedAt: expect.any(Date),
      }),
    );
    expect(dispatch).toHaveBeenCalledWith({ type: 'SESSION_LOADED', user: saved });
  });

  it('rejects when there is no stored profile', async () => {
    const persist = vi.fn();
    const dispatch = vi.fn();

    await expect(
      saveUpdatedProfile({
        current: null,
        updates: { name: 'New Name' },
        dispatch,
        persist,
      }),
    ).rejects.toThrow('No user profile to update');

    expect(persist).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
