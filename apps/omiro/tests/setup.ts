import { vi } from 'vitest';

process.env.EXPO_PUBLIC_API_BASE_URL ??= 'http://localhost:4040';

Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: false });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// expo-sqlite is native. Unit tests use the in-memory store or node:sqlite; a
// test that reaches the real database should fail loudly, not crash on load.
vi.mock('expo-sqlite', () => ({
  openDatabaseSync: () => {
    throw new Error('expo-sqlite is not available in unit tests');
  },
}));

// expo-crypto needs the native runtime; Node's own randomUUID stands in.
vi.mock('expo-crypto', () => ({
  randomUUID: () => globalThis.crypto.randomUUID(),
}));
