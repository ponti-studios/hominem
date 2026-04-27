import type { ChatIconName } from '@hominem/chat';
import type { SessionSource } from '@hominem/rpc/types';
import {
  Copy,
  Globe,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Share2,
  Square,
  SquarePen,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';

import type { ExtendedMessage } from '../../types/chat';

export const mockSessionSources = {
  new: { kind: 'new' },
  capture: {
    kind: 'capture',
    preview: 'Ideas for the next onboarding pass and how to keep it concise',
  },
  note: {
    kind: 'artifact',
    id: 'note-1',
    type: 'note',
    title: 'Q3 planning follow-up',
  },
} satisfies Record<string, SessionSource>;

export const mockChatMessages: ExtendedMessage[] = [
  {
    id: 'msg-1',
    chatId: 'chat-1',
    userId: 'user-1',
    role: 'user',
    content: 'Can you summarize these notes into a short action list?',
    files: null,
    referencedNotes: null,
    toolCalls: null,
    reasoning: null,
    parentMessageId: null,
    createdAt: '2026-03-25T15:20:00.000Z',
    updatedAt: '2026-03-25T15:20:00.000Z',
  },
  {
    id: 'msg-2',
    chatId: 'chat-1',
    userId: 'assistant-1',
    role: 'assistant',
    content: 'Absolutely.\n\n- Confirm scope\n- Draft the follow-up note\n- Send it to the team\n',
    files: null,
    referencedNotes: null,
    toolCalls: [
      {
        toolName: 'search_notes',
        type: 'tool-call',
        toolCallId: 'tool-1',
        args: { query: 'follow-up' },
      },
    ],
    reasoning: 'I should first verify the relevant note, then turn it into a clear list.',
    parentMessageId: 'msg-1',
    createdAt: '2026-03-25T15:21:00.000Z',
    updatedAt: '2026-03-25T15:21:00.000Z',
  },
  {
    id: 'msg-3',
    chatId: 'chat-1',
    userId: 'assistant-1',
    role: 'assistant',
    content: 'Working on the final wording…',
    files: null,
    referencedNotes: null,
    toolCalls: null,
    reasoning: null,
    parentMessageId: 'msg-2',
    createdAt: '2026-03-25T15:22:00.000Z',
    updatedAt: '2026-03-25T15:22:00.000Z',
    isStreaming: true,
  },
];

export const mockUserMessage = mockChatMessages[0];
export const mockAssistantMessage = mockChatMessages[1];
export const mockStreamingAssistantMessage = mockChatMessages[2];

export function renderChatIcon(
  name: ChatIconName,
  props: {
    color?: string;
    size: number;
    style?: object;
  },
) {
  const iconProps = {
    color: props.color,
    size: props.size,
    style: props.style,
  };

  switch (name) {
    case 'arrow.clockwise':
      return <RotateCcw {...iconProps} />;
    case 'doc.on.doc':
      return <Copy {...iconProps} />;
    case 'ellipsis':
      return <MoreVertical {...iconProps} />;
    case 'magnifyingglass':
      return <Search {...iconProps} />;
    case 'square.and.pencil':
      return <SquarePen {...iconProps} />;
    case 'plus':
      return <Plus {...iconProps} />;
    case 'square.and.arrow.up':
      return <Share2 {...iconProps} />;
    case 'speaker.wave.2':
      return <Volume2 {...iconProps} />;
    case 'stop.fill':
      return <Square {...iconProps} />;
    case 'trash':
      return <Trash2 {...iconProps} />;
    case 'xmark':
      return <X {...iconProps} />;
    default:
      return <Globe {...iconProps} />;
  }
}
