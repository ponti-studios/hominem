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

// expo-notifications is native; tests plan and reconcile with a fake scheduler.
vi.mock('expo-notifications', () => ({}));

// System glass and the Reanimated press feedback are native; tests render
// plain elements in their place.
vi.mock('~/components/ui/glass', async () => (await import('./mocks/glass')).glassModuleMock);
vi.mock(
  '~/components/ui/pressable-scale',
  async () => (await import('./mocks/glass')).pressableScaleModuleMock,
);

// The system-integration module (Spotlight, quick actions, text recognition,
// PDF export) is native; tests that care replace it with their own fake.
vi.mock('~/modules/omiro-system', () => ({
  default: {
    addListener: () => ({ remove: () => undefined }),
    clearSpotlight: async () => undefined,
    consumePendingLink: () => null,
    indexSpotlightItems: async () => undefined,
    recognizeText: async () => '',
    removeSpotlightItems: async () => undefined,
    renderPdf: async () => '',
  },
}));
