import React from 'react'
import { screen } from '@testing-library/react-native'

import ChatDetailScreen from '../../app/(protected)/(tabs)/chat/[id]'
import { press, renderScreen } from '../support/render'

const mockSpeak = jest.fn()

jest.mock('expo-router')

jest.mock('~/components/media/use-tts', () => ({
  useTTS: () => ({
    speak: mockSpeak,
    speakingId: null,
    state: 'idle',
  }),
}))

jest.mock('~/utils/services/chat', () => ({
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
    renderScreen(<ChatDetailScreen />, {
      pathname: '/(protected)/(tabs)/chat/chat-1',
      params: { id: 'chat-1' },
    })

    expect(screen.getByText('PLAY AUDIO')).toBeTruthy()
    expect(screen.queryByText('LIBRARY')).toBeNull()
    expect(screen.queryByText('CAMERA')).toBeNull()
    expect(screen.queryByText('SEND')).toBeNull()
  })

  it('routes assistant playback through the unified speech hook', async () => {
    renderScreen(<ChatDetailScreen />, {
      pathname: '/(protected)/(tabs)/chat/chat-1',
      params: { id: 'chat-1' },
    })

    await press(screen.getByText('PLAY AUDIO'))

    expect(mockSpeak).toHaveBeenCalledWith('assistant-1', 'Here is a spoken answer.')
  })
})
