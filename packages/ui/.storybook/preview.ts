import type { Preview } from '@storybook/react-vite'
import { sb } from 'storybook/test'
import { initialize, mswLoader } from 'msw-storybook-addon'
import { INITIAL_VIEWPORTS } from 'storybook/viewport'

import { handlers } from '../src/mocks/handlers'
import { commonControlsExclude } from '../src/storybook/controls'

import '../src/animations.css'
import '../src/styles.css'

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

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color|accent|fill)$/i,
        date: /Date$/i,
      },
      exclude: commonControlsExclude,
      sort: 'requiredFirst',
      expanded: true,
    },
    options: {
      storySort: {
        order: [
          'Documentation',
          'Patterns',
          [
            'Chat',
            ['CodeBlock', 'Context', 'Conversation', 'MarkdownContent', 'Reasoning', 'Sources', 'Suggestion', 'Tool'],
            'Composer',
            ['Attachments', 'AudioPlayer', 'PromptInput', 'SpeechInput', 'Transcription'],
            'Workflow',
            ['Checkpoint', 'Plan', 'ProposalCard', 'Queue', 'Task'],
            'Feedback',
            ['Confirmation'],
          ],
        ],
      },
    },
    msw: {
      handlers,
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
  initialGlobals: {
    viewport: {
      value: 'desktop',
    },
  },
}

export default preview
