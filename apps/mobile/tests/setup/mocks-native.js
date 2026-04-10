const ReactNative = require('react-native')

if (ReactNative.Platform && typeof ReactNative.Platform.select !== 'function') {
  ReactNative.Platform.select = (options) => {
    if (ReactNative.Platform.OS && ReactNative.Platform.OS in options) {
      return options[ReactNative.Platform.OS]
    }
    return options.default
  }
}

jest.mock('expo-router')
jest.mock('expo-image')
jest.mock('react-native-safe-area-context')
jest.mock('react-native-reanimated')
jest.mock('posthog-react-native', () => ({
  PostHog: jest.fn().mockImplementation(() => ({
    capture: jest.fn(),
    captureException: jest.fn(),
    identify: jest.fn(),
    reset: jest.fn(),
  })),
}))
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
      hostUri: undefined,
    },
    manifest2: undefined,
  },
}))
jest.mock('expo-device', () => ({
  isDevice: false,
}))
