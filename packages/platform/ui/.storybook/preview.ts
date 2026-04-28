import { createElement } from 'react'

import type { Preview } from '@storybook/react-vite'
import { sb } from 'storybook/test'
import { initialize, mswLoader } from 'msw-storybook-addon'
import { create } from 'storybook/theming/create'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { handlers } from '../src/mocks/handlers'
import { commonControlsExclude } from '../src/storybook/controls'

import '../src/styles/animations.css'
import '../src/styles/globals.css'

sb.mock('expo-clipboard', {
  getStringAsync: async () => '',
  setString: () => {},
  setStringAsync: async () => {},
} as unknown as Parameters<typeof sb.mock>[1])
sb.mock('expo-file-system/legacy', {
  EncodingType: { UTF8: 'utf8' },
  cacheDirectory: '/tmp/',
  readAsStringAsync: async () => '',
  writeAsStringAsync: async () => {},
} as unknown as Parameters<typeof sb.mock>[1])
sb.mock('expo-haptics', {
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
  impactAsync: async () => {},
  notificationAsync: async () => {},
  selectionAsync: async () => {},
} as unknown as Parameters<typeof sb.mock>[1])
sb.mock('expo-sharing', {
  isAvailableAsync: async () => false,
  shareAsync: async () => {},
} as unknown as Parameters<typeof sb.mock>[1])

const ignoredMswRequestPattern = /\.(avif|css|gif|ico|jpeg|jpg|png|svg|webp)$/i

initialize({
  quiet: true,
  onUnhandledRequest: ({ url }, print) => {
    if (ignoredMswRequestPattern.test(String(url))) return
    print.warning()
  },
})

const darkDocsTheme = create({
  base: 'dark',
  colorPrimary: 'rgba(142, 141, 255, 1)',
  colorSecondary: 'rgba(142, 141, 255, 1)',
  appBg: 'rgba(17, 17, 19, 1)',
  appContentBg: 'rgba(17, 17, 19, 1)',
  appPreviewBg: 'rgba(17, 17, 19, 1)',
  appBorderColor: 'rgba(245, 246, 248, 0.18)',
  appBorderRadius: 6,
  fontBase:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', system-ui, sans-serif",
  fontCode: "'SF Mono', 'Menlo', ui-monospace, monospace",
  textColor: 'rgba(245, 246, 248, 1)',
  textInverseColor: 'rgba(17, 17, 19, 1)',
  textMutedColor: 'rgba(141, 147, 161, 1)',
  barTextColor: 'rgba(180, 185, 195, 1)',
  barHoverColor: 'rgba(245, 246, 248, 1)',
  barSelectedColor: 'rgba(142, 141, 255, 1)',
  barBg: 'rgba(24, 25, 27, 1)',
  inputBg: 'rgba(24, 25, 27, 1)',
  inputBorder: 'rgba(245, 246, 248, 0.18)',
  inputTextColor: 'rgba(245, 246, 248, 1)',
  inputBorderRadius: 6,
})

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        base: { name: 'base', value: '#111113' },
        surface: { name: 'surface', value: '#18191b' },
        elevated: { name: 'elevated', value: '#212225' },
      },
    },
    controls: {
      matchers: {
        color: /(background|color|accent|fill)$/i,
        date: /Date$/i,
      },
      exclude: commonControlsExclude,
      sort: 'requiredFirst',
      expanded: true,
    },
    msw: {
      handlers,
    },
    docs: {
      theme: darkDocsTheme,
    },
    viewport: {
      options: {
        ...INITIAL_VIEWPORTS,
        mobile: {
          name: 'Mobile (375)',
          styles: { width: '375px', height: '812px' },
          type: 'mobile',
        },
        tablet: {
          name: 'Tablet (768)',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        desktop: {
          name: 'Desktop (1280)',
          styles: { width: '1280px', height: '900px' },
          type: 'desktop',
        },
        wide: {
          name: 'Wide (1440)',
          styles: { width: '1440px', height: '900px' },
          type: 'desktop',
        },
      },
    },
  },
  loaders: [mswLoader],
  decorators: [
    (Story) =>
      createElement(
        'div',
        {
          className: 'p-8',
          style: {
            backgroundColor: 'rgba(17, 17, 19, 1)',
            colorScheme: 'dark' as const,
            minHeight: '100%',
          },
        },
        createElement(Story)
      ),
  ],
  initialGlobals: {
    backgrounds: {
      value: 'base',
    },
    viewport: {
      value: 'desktop',
    },
  },
}

export default preview
