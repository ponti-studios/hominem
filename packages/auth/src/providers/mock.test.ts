/**
 * Tests for MockAuthProvider
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_MOCK_USER, MOCK_USERS } from '../mock-users';
import { MockAuthProvider } from '../providers/mock';

describe('MockAuthProvider', () => {
  let provider: MockAuthProvider;

  beforeEach(() => {
    provider = new MockAuthProvider();
  });

  describe('signIn', () => {
    it('should return a user on sign in', async () => {
      const response = await provider.signIn();

      expect(response.user).toBeDefined();
      expect(response.user.id).toBe(DEFAULT_MOCK_USER.id);
      expect(response.user.email).toBe(DEFAULT_MOCK_USER.email);
    });
  });

  describe('signOut', () => {
    it('should complete sign out successfully', async () => {
      await expect(provider.signOut()).resolves.toBeUndefined();
    });
  });

  describe('user selection', () => {
    it('should use default user when none specified', () => {
      const current = provider.getCurrentUser();
      expect(current.id).toBe(DEFAULT_MOCK_USER.id);
    });

    it('should use specified user if provided', () => {
      const provider2 = new MockAuthProvider('tester');
      const current = provider2.getCurrentUser();

      expect(current.id).toBe(MOCK_USERS.tester.id);
      expect(current.email).toBe(MOCK_USERS.tester.email);
    });

    it('should switch to different user', () => {
      const current1 = provider.getCurrentUser();
      expect(current1.id).toBe(DEFAULT_MOCK_USER.id);

      const switched = provider.switchUser('tester');
      expect(switched.id).toBe(MOCK_USERS.tester.id);

      const current2 = provider.getCurrentUser();
      expect(current2.id).toBe(MOCK_USERS.tester.id);
    });

    it('should throw error when switching to non-existent user', () => {
      expect(() => provider.switchUser('non-existent')).toThrow();
    });
  });
});
