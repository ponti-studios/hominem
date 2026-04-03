import appConfig from '../app.config'

const { EXPO_OWNER, EXPO_PROJECT_ID, EXPO_PROJECT_SLUG, getExpoExtraConfig } = require(
  '../config/expo-config.js',
) as {
  EXPO_OWNER: string
  EXPO_PROJECT_ID: string
  EXPO_PROJECT_SLUG: string
  getExpoExtraConfig: (env: Record<string, string | undefined>) => {
    apiBaseUrl: string
    e2eTesting: string
    e2eAuthSecret: string
    mobilePasskeyEnabled: string
  }
}

function withAppVariant<T>(variant: string, callback: () => T) {
  const previousVariant = process.env.APP_VARIANT

  process.env.APP_VARIANT = variant

  try {
    return callback()
  } finally {
    if (previousVariant === undefined) {
      delete process.env.APP_VARIANT
    } else {
      process.env.APP_VARIANT = previousVariant
    }
  }
}

describe('expo config helpers', () => {
  it('returns stable expo identity', () => {
    expect(EXPO_OWNER).toBe('pontistudios')
    expect(EXPO_PROJECT_ID).toBe('4dfac82b-644f-4ff3-be42-e8f941287aa1')
    expect(EXPO_PROJECT_SLUG).toBe('hakumi')
  })

  it('fills release-sensitive extra fields with deterministic defaults', () => {
    expect(getExpoExtraConfig({})).toEqual({
      apiBaseUrl: '',
      e2eTesting: 'false',
      e2eAuthSecret: '',
      mobilePasskeyEnabled: 'false',
    })
  })

  it('preserves explicit env values', () => {
    expect(
      getExpoExtraConfig({
        EXPO_PUBLIC_E2E_TESTING: 'true',
        EXPO_PUBLIC_E2E_AUTH_SECRET: 'secret',
        EXPO_PUBLIC_MOBILE_PASSKEY_ENABLED: 'true',
        EXPO_PUBLIC_API_BASE_URL: 'http://localhost:4040',
      }),
    ).toEqual({
      apiBaseUrl: 'http://localhost:4040',
      e2eTesting: 'true',
      e2eAuthSecret: 'secret',
      mobilePasskeyEnabled: 'true',
    })
  })

  it('includes the voice transcription permission copy and omits calendar access copy', () => {
    const config = withAppVariant('dev', () =>
      appConfig({ config: {}, packageJsonPath: '', projectRoot: '', staticConfigPath: '' }),
    )
    const infoPlist = config.ios?.infoPlist as Record<string, unknown> | undefined

    expect(infoPlist).toMatchObject({
      ITSAppUsesNonExemptEncryption: false,
      NSMicrophoneUsageDescription:
        'Allow Hakumi to access your microphone to transcribe voice notes.',
    })
    expect(infoPlist?.NSCalendarsUsageDescription).toBeUndefined()
    expect(infoPlist?.NSRemindersUsageDescription).toBeUndefined()
  })

  it('keeps release variants free of dev-only apple signing config', () => {
    const previousTeamId = process.env.EXPO_APPLE_TEAM_ID

    process.env.EXPO_APPLE_TEAM_ID = '3QHJ2KN8AL'

    const config = withAppVariant('preview', () =>
      appConfig({ config: {}, packageJsonPath: '', projectRoot: '', staticConfigPath: '' }),
    )

    expect(config.ios?.appleTeamId).toBeUndefined()

    if (previousTeamId === undefined) {
      delete process.env.EXPO_APPLE_TEAM_ID
    } else {
      process.env.EXPO_APPLE_TEAM_ID = previousTeamId
    }
  })

  it('derives the app group from the active bundle identifier', () => {
    const config = withAppVariant('preview', () =>
      appConfig({ config: {}, packageJsonPath: '', projectRoot: '', staticConfigPath: '' }),
    )

    expect(config.ios?.bundleIdentifier).toBe('com.pontistudios.hakumi.preview')
    expect(config.ios?.entitlements?.['com.apple.security.application-groups']).toEqual([
      'group.com.pontistudios.hakumi.preview',
    ])
  })

  it.each([
    ['dev', './assets/logo.hakumi.dev.png'],
    ['e2e', './assets/logo.hakumi.dev.png'],
    ['preview', './assets/logo.hakumi.preview.png'],
    ['production', './assets/logo.hakumi.png'],
  ] as const)('resolves Expo-managed brand assets for %s', (variant, expectedIcon) => {
    const config = withAppVariant(variant, () =>
      appConfig({ config: {}, packageJsonPath: '', projectRoot: '', staticConfigPath: '' }),
    )

    expect(config.icon).toBe(expectedIcon)
    expect(config.ios?.icon).toBe(expectedIcon)
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe(expectedIcon)
    expect(config.web?.favicon).toBe('./assets/logo.hakumi.png')
    expect(config.plugins).toContainEqual([
      'expo-splash-screen',
      {
        backgroundColor: '#000000',
        image: './assets/logo.hakumi.splash-screen.png',
        resizeMode: 'contain',
      },
    ])
  })

  it('omits the custom Android notification icon override', () => {
    const config = withAppVariant('preview', () =>
      appConfig({ config: {}, packageJsonPath: '', projectRoot: '', staticConfigPath: '' }),
    )

    expect(config.plugins).toContainEqual([
      'expo-notifications',
      {
        color: '#000000',
      },
    ])
  })
})
