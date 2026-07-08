import { vi } from 'vitest';

/**
 * Dynamically imports createServer with the given environment variables mocked.
 * Merges overrides onto the real env so Better Auth still has baseURL, secrets, etc.
 * Returns a factory that produces a fresh app instance per call.
 */
export async function importServerWithEnv(envOverrides: Record<string, string>) {
  vi.resetModules();
  vi.doMock('../../env', async () => {
    const actual = await vi.importActual<typeof import('../../env')>('../../env');
    return {
      env: {
        ...actual.env,
        ...envOverrides,
      },
    };
  });

  const { createServer } = await import('../../server');
  return createServer;
}
