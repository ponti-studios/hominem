import { describe, expect, it, vi } from 'vitest';

import { updateProfile } from '~/services/auth/hooks/use-update-profile';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock('~/services/auth/auth-client', () => ({
  authClient: { updateUser: mocks.updateUser },
}));

describe('updateProfile', () => {
  it('calls HominemAuth update-user with only the provided fields', async () => {
    mocks.updateUser.mockResolvedValue({ id: 'user-1', name: 'New Name' });

    await updateProfile({ name: 'New Name' });

    expect(mocks.updateUser).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('throws when HominemAuth rejects the update', async () => {
    mocks.updateUser.mockRejectedValue(new Error('Failed to update profile'));

    await expect(updateProfile({ name: 'New Name' })).rejects.toThrow('Failed to update profile');
  });
});
