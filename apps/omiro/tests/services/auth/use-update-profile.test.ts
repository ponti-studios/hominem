import { describe, expect, it, vi } from 'vitest';

import { updateProfile } from '~/services/auth/hooks/use-update-profile';

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
}));

vi.mock('~/services/auth/auth-client', () => ({
  authClient: { updateUser: mocks.updateUser },
}));

describe('updateProfile', () => {
  it('calls Better Auth update-user with only the provided fields', async () => {
    mocks.updateUser.mockResolvedValue({ data: { status: true }, error: null });

    await updateProfile({ name: 'New Name' });

    expect(mocks.updateUser).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('throws when Better Auth returns an error', async () => {
    mocks.updateUser.mockResolvedValue({
      data: null,
      error: { message: 'Failed to update profile' },
    });

    await expect(updateProfile({ name: 'New Name' })).rejects.toThrow('Failed to update profile');
  });
});
