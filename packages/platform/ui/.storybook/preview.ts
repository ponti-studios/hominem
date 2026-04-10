import { createElement } from 'react'

import type { Preview } from '@storybook/react-vite'
import { sb } from 'storybook/test'
import { initialize, mswLoader } from 'msw-storybook-addon'

import { handlers } from '../src/mocks/handlers'
import { commonControlsExclude } from '../src/storybook/controls'

import '../src/styles/animations.css'
import '../src/styles/globals.css'

sb.mock('expo-clipboard', () => ({
  getStringAsync: async () => '',
  setString: () => {},
  setStringAsync: async () => {},
}))
sb.mock('expo-file-system/legacy', () => ({
  EncodingType: { UTF8: 'utf8' },
  cacheDirectory: '/tmp/',
  readAsStringAsync: async () => '',
  writeAsStringAsync: async () => {},
}))
sb.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Warning: 'warning' },
  impactAsync: async () => {},
  notificationAsync: async () => {},
  selectionAsync: async () => {},
}))
sb.mock('expo-sharing', () => ({
  isAvailableAsync: async () => false,
  shareAsync: async () => {},
}))

const ignoredMswRequestPattern = /\.(avif|css|gif|ico|jpeg|jpg|png|svg|webp)$/i

initialize({
  quiet: true,
  onUnhandledRequest: ({ url }, print) => {
    if (ignoredMswRequestPattern.test(String(url))) return
    print.warning()
  },
})

const preview: Preview = {
  parameters: {
    backgrounds: {
      options: {
        base: { name: 'base', value: '#ffffff' },
        surface: { name: 'surface', value: '#f5f5f7' },
        elevated: { name: 'elevated', value: '#f2f2f7' },
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
  },
  loaders: [mswLoader],
  decorators: [
    (Story) => createElement('div', { className: 'p-8' }, createElement(Story)),
  ],
  initialGlobals: {
    backgrounds: {
      value: 'base',
    },
  },
}

export default preview
