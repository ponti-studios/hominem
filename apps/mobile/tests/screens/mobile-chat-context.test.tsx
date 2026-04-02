import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import Chat from '../../app/(protected)/(tabs)/chat/index'
import {
  MobileWorkspaceProvider,
  useMobileWorkspace,
} from '../../components/workspace/mobile-workspace-context'

const mockPush = jest.fn()
const mockRefetch = jest.fn()

let workspaceContext = 'inbox'

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ chatId: 'chat-1' }),
  usePathname: () => '/(protected)/(tabs)/chat',
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../../components/media/camera-modal', () => ({
  CameraModal: () => null,
}))

jest.mock('../../lib/use-chat-live-activity', () => ({
  useChatLiveActivity: () => ({
    stop: () => undefined,
  }),
}))

jest.mock('../../components/media/mobile-voice-input', () => ({
  MobileVoiceInput: () => null,
}))

jest.mock('../../components/media/use-tts', () => ({
  useTTS: () => ({
    speak: jest.fn(),
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
    makeStyles: () => () => ({}),
    theme: {
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      'text-secondary': '#999999',
      'text-tertiary': '#777777',
      'border-default': '#333333',
      destructive: '#ff0000',
    },
    spacing: {
      xs_4: 4,
      sm_8: 8,
      sm_12: 12,
      m_16: 16,
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
    refetch: mockRefetch,
  }),
  useChatMessages: () => ({
    data: [],
  }),
  useSendMessage: () => ({
    isChatSending: false,
    sendChatMessage: jest.fn().mockResolvedValue(undefined),
  }),
  useStartChat: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}))

jest.mock('../../utils/services/files/use-file-upload', () => ({
  useFileUpload: () => ({
    clearErrors: jest.fn(),
    uploadAssets: jest.fn().mockResolvedValue([]),
    uploadState: {
      errors: [],
    },
  }),
}))

jest.mock('../../utils/services/notes/use-note-stream', () => ({
  useNoteStream: () => ({
    data: [],
  }),
}))

function WorkspaceProbe() {
  const { activeContext } = useMobileWorkspace()
  workspaceContext = activeContext

  return null
}

describe('mobile chat workspace context', () => {
  beforeEach(() => {
    workspaceContext = 'inbox'
    mockPush.mockReset()
    mockRefetch.mockResolvedValue({
      data: {
        id: 'chat-1',
      },
    })
  })

  it('switches the shared workspace context to chat when the chat route mounts', async () => {
    await render(
      <MobileWorkspaceProvider>
        <WorkspaceProbe />
        <Chat />
      </MobileWorkspaceProvider>,
    )

    await waitFor(() => {
      expect(workspaceContext).toBe('chat')
    })
  })
})
