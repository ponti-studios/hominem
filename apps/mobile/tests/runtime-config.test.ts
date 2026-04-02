import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockExpoConstants = {
  expoConfig: {
    extra: {},
    hostUri: undefined,
  },
  manifest2: undefined,
}

let mockIsDevice = false

vi.mock('expo-constants', () => ({
  default: mockExpoConstants,
}))

vi.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice
  },
}))

describe('mobile runtime config', () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.APP_VARIANT
    delete process.env.EXPO_PUBLIC_API_BASE_URL
    mockIsDevice = false
    mockExpoConstants.expoConfig = {
      extra: {},
      hostUri: undefined,
    }
    mockExpoConstants.manifest2 = undefined
  })

  it('treats preview and production as release variants', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.ponti.io'
    mockExpoConstants.expoConfig = {
      extra: {
        appVariant: 'preview',
      },
      hostUri: undefined,
    }
    mockIsDevice = true

    const { isReleaseAppVariant } = await import('../utils/constants')

    expect(isReleaseAppVariant('preview')).toBe(true)
    expect(isReleaseAppVariant('production')).toBe(true)
    expect(isReleaseAppVariant('dev')).toBe(false)
  })

  it('throws when preview runtime is missing the API base URL', async () => {
    mockExpoConstants.expoConfig = {
      extra: {
        appVariant: 'preview',
      },
      hostUri: undefined,
    }
    mockIsDevice = true

    await expect(import('../utils/constants')).rejects.toThrow(
      'Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL in mobile runtime configuration for preview.',
    )
  })

  it('keeps localhost for simulator runtimes', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4040'
    mockExpoConstants.expoConfig = {
      hostUri: '192.168.1.153:8081',
      extra: {
        appVariant: 'dev',
        apiBaseUrl: 'http://localhost:4040',
      },
    }
    mockIsDevice = false

    const { API_BASE_URL } = await import('../utils/constants')

    expect(API_BASE_URL).toBe('http://localhost:4040')
  })

  it('rewrites localhost for physical devices', async () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4040'
    mockExpoConstants.expoConfig = {
      hostUri: '192.168.1.153:8081',
      extra: {
        appVariant: 'dev',
        apiBaseUrl: 'http://localhost:4040',
      },
    }
    mockIsDevice = true

    const { API_BASE_URL } = await import('../utils/constants')

    expect(API_BASE_URL).toBe('http://192.168.1.153:4040')
  })

  it('uses the canonical local API fallback port in development', async () => {
    mockExpoConstants.expoConfig = {
      hostUri: '192.168.1.153:8081',
      extra: {
        appVariant: 'dev',
      },
    }
    mockIsDevice = false

    const { API_BASE_URL } = await import('../utils/constants')

    expect(API_BASE_URL).toBe('http://localhost:4040')
  })
})
