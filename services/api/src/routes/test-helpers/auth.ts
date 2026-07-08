import { vi } from 'vitest';

/**
 * Dynamically imports createServer with the given environment variables mocked.
 * Returns a factory that produces a fresh app instance per call.
 */
export async function importServerWithEnv(envOverrides: Record<string, string>) {
  vi.doMock('../../env', () => ({
    env: envOverrides,
  }));

  const { createServer } = await import('../../server');
  return createServer;
}
