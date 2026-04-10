import { createElement } from 'react'

import { definePreview } from 'storybook/internal/csf'
import type { WebRenderer } from 'storybook/internal/types'
import { sb } from 'storybook/test'
import { initialize, mswLoader } from 'msw-storybook-addon'

import { handlers } from '../src/mocks/handlers'
import { commonControlsExclude } from '../src/storybook/controls'

import '../src/styles/animations.css'
import '../src/styles/globals.css'

sb.mock(import('expo-clipboard'))
sb.mock(import('expo-file-system/legacy'))
sb.mock(import('expo-haptics'))
sb.mock(import('expo-sharing'))

const ignoredMswRequestPattern = /\.(avif|css|gif|ico|jpeg|jpg|png|svg|webp)$/i

initialize({
  quiet: true,
  onUnhandledRequest: ({ url }, print) => {
    if (ignoredMswRequestPattern.test(String(url))) return
    print.warning()
  },
})

const preview = definePreview<WebRenderer, []>({
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
})

export default preview
