// Mock auth provider for local development
interface MockAuthProvider {
  signIn: () => Promise<{ user: { id: string; email: string; name: string }; session: { id: string } }>;
  signOut: () => Promise<void>;
}

export function createMockAuthProvider(): MockAuthProvider {
  return {
    signIn: async () => ({
      user: {
        id: 'mock-user-id',
        email: 'mock@hominem.test',
        name: 'Mock User',
      },
      session: {
        id: 'mock-session-id',
      },
    }),
    signOut: async () => {},
  };
}
