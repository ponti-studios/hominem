const { cleanup } = require('@testing-library/react-native')

jest.mock('expo-router')
jest.mock('expo-image')
jest.mock('react-native-safe-area-context')
jest.mock('react-native-reanimated')
jest.mock('~/components/error-boundary', () => ({
  FeatureErrorBoundary: ({ children }) => children,
}))
jest.mock('~/components/LoadingFull', () => ({
  LoadingFull: ({ children }) => children ?? null,
}))
jest.mock('~/components/Button', () => {
  const React = require('react')

  return {
    Button: ({ title, testID, onPress, disabled }) =>
      React.createElement(
        'TouchableOpacity',
        {
          accessibilityRole: 'button',
          accessibilityState: { disabled: Boolean(disabled) },
          disabled,
          onPress,
          testID,
        },
        React.createElement('Text', null, title),
      ),
  }
})
jest.mock('~/components/text-input', () => {
  const React = require('react')
  const { forwardRef, useImperativeHandle } = React

  return {
    __esModule: true,
    default: forwardRef(function MockTextInput(props, ref) {
      useImperativeHandle(ref, () => ({
        focus: () => undefined,
      }))

      return React.createElement('TextInput', props)
    }),
  }
})
jest.mock('~/theme', () => {
  const React = require('react')
  const theme = {
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      muted: '#111111',
      mutedForeground: '#999999',
      white: '#ffffff',
      black: '#000000',
      destructive: '#FF3B30',
      'fg-primary': '#ffffff',
      'text-secondary': '#999999',
      'text-tertiary': '#777777',
      'border-default': '#333333',
      'border-focus': '#666666',
      'bg-surface': '#111111',
      'bg-base': '#111111',
      'bg-elevated': '#111111',
      'overlay-modal-high': 'rgba(0,0,0,0.8)',
      'emphasis-lower': '#222222',
    },
    spacing: {
      xs_4: 4,
      sm_8: 8,
      sm_12: 12,
      m_16: 16,
      ml_24: 24,
      l_32: 32,
      xl_48: 48,
      xl_64: 64,
    },
    borderRadii: {
      s_3: 3,
      sm_6: 6,
      m_6: 6,
      md: 12,
      md_10: 10,
      l_12: 12,
      lg_14: 14,
      xl_20: 20,
      xl_24: 24,
      full: 999,
    },
  }

  return {
    Box: ({ children, testID, ...props }) => React.createElement('View', { testID, ...props }, children),
    Text: ({ children, testID, ...props }) => React.createElement('Text', { testID, ...props }, children),
    makeStyles: (factory) => () => factory(theme),
    theme,
  }
})

afterEach(() => {
  cleanup()
  jest.clearAllMocks()
  jest.useRealTimers()
  const { resetMockRouter } = require('../support/router')
  resetMockRouter()
})
