import React from 'react'
import { render, waitFor } from '@testing-library/react-native'

import Chat from '../../app/(protected)/(tabs)/chat/index'
import {
  MobileWorkspaceProvider,
  useMobileWorkspace,
} from '../../components/workspace/mobile-workspace-context'

const mockPush = vi.fn()
const mockRefetch = vi.fn()

let workspaceContext = 'inbox'

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ chatId: 'chat-1' }),
  usePathname: () => '/(protected)/(tabs)/chat',
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('../../components/chat/blurred-background', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../../components/media/camera-modal', () => ({
  CameraModal: () => null,
}))

vi.mock('../../lib/use-chat-live-activity', () => ({
  useChatLiveActivity: () => ({
    stop: () => undefined,
  }),
}))

vi.mock('../../components/media/mobile-voice-input', () => ({
  MobileVoiceInput: () => null,
}))

vi.mock('../../components/media/use-tts', () => ({
  useTTS: () => ({
    speak: vi.fn(),
    state: 'idle',
  }),
}))

vi.mock('../../components/LoadingFull', () => ({
  LoadingFull: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('../../theme', () => ({
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
}))

vi.mock('../../utils/services/chat', () => ({
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
    sendChatMessage: vi.fn().mockResolvedValue(undefined),
  }),
  useStartChat: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}))

vi.mock('../../utils/services/files/use-file-upload', () => ({
  useFileUpload: () => ({
    clearErrors: vi.fn(),
    uploadAssets: vi.fn().mockResolvedValue([]),
    uploadState: {
      errors: [],
    },
  }),
}))

vi.mock('../../utils/services/notes/use-note-stream', () => ({
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
