import React from 'react'
import { fireEvent, render } from '@testing-library/react-native'

import ChatDetailScreen from '../../app/(protected)/(tabs)/chat/[id]'

const mockSpeak = jest.fn()

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'chat-1' }),
}))

jest.mock('../../components/media/use-tts', () => ({
  useTTS: () => ({
    speak: mockSpeak,
    speakingId: null,
    state: 'idle',
  }),
}))

jest.mock('../../components/LoadingFull', () => {
  const React = require('react')
  return {
    LoadingFull: ({ children }: { children: React.ReactNode }) => children,
  }
})

jest.mock('../../theme', () => {
  const React = require('react')
  return {
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement('Text', null, children),
    theme: {
      colors: {
        background: '#000000',
        foreground: '#ffffff',
        muted: '#111111',
        'text-secondary': '#999999',
        'text-tertiary': '#777777',
        'border-default': '#333333',
      },
      spacing: {
        xs_4: 4,
        sm_12: 12,
        m_16: 16,
        ml_24: 24,
      },
      borderRadii: {
        md: 12,
      },
    },
  }
})

jest.mock('../../utils/services/chat', () => ({
  useActiveChat: () => ({
    data: {
      id: 'chat-1',
    },
    isLoading: false,
  }),
  useChatMessages: () => ({
    data: [
      {
        id: 'assistant-1',
        role: 'assistant',
        message: 'Here is a spoken answer.',
      },
    ],
  }),
}))

describe('mobile chat detail screen', () => {
  beforeEach(() => {
    mockSpeak.mockReset()
  })

  it('renders messages without the inline composer controls', () => {
    const screen = render(<ChatDetailScreen />)

    expect(screen.getByText('PLAY AUDIO')).toBeTruthy()
    expect(screen.queryByText('LIBRARY')).toBeNull()
    expect(screen.queryByText('CAMERA')).toBeNull()
    expect(screen.queryByText('SEND')).toBeNull()
  })

  it('routes assistant playback through the unified speech hook', () => {
    const screen = render(<ChatDetailScreen />)

    fireEvent.press(screen.getByText('PLAY AUDIO'))

    expect(mockSpeak).toHaveBeenCalledWith('assistant-1', 'Here is a spoken answer.')
  })
})
