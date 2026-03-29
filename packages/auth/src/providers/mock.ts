/**
 * Mock Authentication Provider for local development
 * This provider simulates sign-in without requiring real credentials
 */

import type { AuthResponse, User } from '../auth.types';
import { DEFAULT_MOCK_USER, MOCK_USERS } from '../mock-users';

/**
 * Mock Authentication Provider
 * Simulates sign-in for local development
 */
export class MockAuthProvider {
  private selectedUser: User;

  constructor(userId?: string) {
    // If a specific user ID is provided, use it; otherwise use the default
    const user = this.getUserById(userId);
    this.selectedUser = user || DEFAULT_MOCK_USER;
  }

  private getUserById(userId?: string): User | undefined {
    if (!userId) return undefined;
    const user = MOCK_USERS[userId as keyof typeof MOCK_USERS];
    return user;
  }

  /**
   * Sign in with mock auth
   * Returns the selected mock user
   */
  async signIn(): Promise<AuthResponse> {
    return {
      user: this.selectedUser,
    };
  }

  /**
   * Sign out (clears the session)
   * In mock auth, there is no remote state to revoke.
   */
  async signOut(): Promise<void> {
    return;
  }

  /**
   * Get the currently selected mock user
   */
  getCurrentUser(): User {
    return this.selectedUser;
  }

  /**
   * Switch to a different mock user (useful for testing)
   */
  switchUser(userId: string): User {
    if (userId in MOCK_USERS) {
      const user = MOCK_USERS[userId as keyof typeof MOCK_USERS];
      if (user) {
        this.selectedUser = user;
        return this.selectedUser;
      }
    }
    throw new Error(`Mock user '${userId}' not found`);
  }
}

/**
 * Get available mock users for selection
 */
export function getAvailableMockUsers(): Record<string, User> {
  return { ...MOCK_USERS };
}

/**
 * Create a mock auth provider instance
 */
export function createMockAuthProvider(userId?: string): MockAuthProvider {
  return new MockAuthProvider(userId);
}
