import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('expo-secure-store', () => ({
  deleteItemAsync: async () => undefined,
  getItemAsync: async () => null,
  setItemAsync: async () => undefined,
}))

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      extra: {
        appScheme: 'hakumi-e2e',
        appVariant: 'e2e',
      },
    },
  },
}))

vi.mock('expo-device', () => ({
  isDevice: false,
}))

vi.mock('@better-auth/expo/client', () => ({
  expoClient: (config: unknown) => ({
    config,
    name: 'expoClient',
  }),
}))

vi.mock('@better-auth/passkey/client', () => ({
  passkeyClient: () => ({
    name: 'passkeyClient',
  }),
}))

vi.mock('better-auth/client/plugins', () => ({
  emailOTPClient: () => ({
    name: 'emailOTPClient',
  }),
}))

vi.mock('better-auth/react', () => ({
  createAuthClient: (config: unknown) => ({
    config,
    signIn: vi.fn(),
  }),
}))

describe('auth client', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://test-api.example.com'
    process.env.APP_VARIANT = 'e2e'
  })

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL
    delete process.env.APP_VARIANT
  })

  it('creates an auth client with the Expo plugin', async () => {
    const { authClient } = await import('./auth-client')

    expect(authClient).toBeDefined()
    expect(typeof authClient.signIn).toBe('function')
  })

  it('uses the active app scheme for auth redirects', async () => {
    const { APP_SCHEME } = await import('~/utils/constants')

    expect(APP_SCHEME).toBe('hakumi-e2e')
  })

  it('uses the configured API base URL', async () => {
    const { API_BASE_URL } = await import('~/utils/constants')

    expect(API_BASE_URL).toBe('https://test-api.example.com')
  })
})
