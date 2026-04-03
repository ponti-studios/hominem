
type MockExpoConfig = {
  extra: {
    appVariant?: string
    apiBaseUrl?: string
  }
  hostUri?: string
}

const mockExpoConstants = {
  expoConfig: {
    extra: {},
    hostUri: undefined,
  } as MockExpoConfig,
  manifest2: undefined,
}

let mockIsDevice = false

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockExpoConstants,
}))

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockIsDevice
  },
}))

function loadConstants() {
  let result: typeof import('../utils/constants') | undefined
  jest.isolateModules(() => {
    result = require('../utils/constants')
  })
  return result!
}

describe('mobile runtime config', () => {
  beforeEach(() => {
    jest.resetModules()
    delete process.env.APP_VARIANT
    delete process.env.EXPO_PUBLIC_API_BASE_URL
    mockIsDevice = false
    mockExpoConstants.expoConfig = {
      extra: {},
      hostUri: undefined,
    } satisfies MockExpoConfig
    mockExpoConstants.manifest2 = undefined
  })

  it('treats preview and production as release variants', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.ponti.io'
    mockExpoConstants.expoConfig = {
      extra: {
        appVariant: 'preview',
      },
      hostUri: undefined,
    } satisfies MockExpoConfig
    mockIsDevice = true

    const { isReleaseAppVariant } = loadConstants()

    expect(isReleaseAppVariant('preview')).toBe(true)
    expect(isReleaseAppVariant('production')).toBe(true)
    expect(isReleaseAppVariant('dev')).toBe(false)
  })

  it('throws when preview runtime is missing the API base URL', () => {
    mockExpoConstants.expoConfig = {
      extra: {
        appVariant: 'preview',
      },
      hostUri: undefined,
    } satisfies MockExpoConfig
    mockIsDevice = true

    expect(() =>
      jest.isolateModules(() => {
        require('../utils/constants')
      }),
    ).toThrow(
      'Missing API base URL. Set EXPO_PUBLIC_API_BASE_URL in mobile runtime configuration for preview.',
    )
  })

  it('keeps localhost for simulator runtimes', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4040'
    mockExpoConstants.expoConfig = {
      hostUri: '192.168.1.153:8081',
      extra: {
        appVariant: 'dev',
        apiBaseUrl: 'http://localhost:4040',
      },
    } satisfies MockExpoConfig
    mockIsDevice = false

    const { API_BASE_URL } = loadConstants()

    expect(API_BASE_URL).toBe('http://localhost:4040')
  })

  it('rewrites localhost for physical devices', () => {
    process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4040'
    mockExpoConstants.expoConfig = {
      hostUri: '192.168.1.153:8081',
      extra: {
        appVariant: 'dev',
        apiBaseUrl: 'http://localhost:4040',
      },
    } satisfies MockExpoConfig
    mockIsDevice = true

    const { API_BASE_URL } = loadConstants()

    expect(API_BASE_URL).toBe('http://192.168.1.153:4040')
  })

  it('uses the canonical local API fallback port in development', () => {
    mockExpoConstants.expoConfig = {
      hostUri: '192.168.1.153:8081',
      extra: {
        appVariant: 'dev',
      },
    } satisfies MockExpoConfig
    mockIsDevice = false

    const { API_BASE_URL } = loadConstants()

    expect(API_BASE_URL).toBe('http://localhost:4040')
  })
})
