import type { ChatMessage as RpcChatMessage } from '@hominem/rpc/types';
import type React from 'react';

export type ChatIconName =
  | 'arrow.clockwise'
  | 'doc.on.doc'
  | 'ellipsis'
  | 'magnifyingglass'
  | 'square.and.pencil'
  | 'plus'
  | 'square.and.arrow.up'
  | 'speaker.wave.2'
  | 'stop.fill'
  | 'trash'
  | 'xmark';

export type ChatRenderIcon = (
  name: ChatIconName,
  props: {
    color?: string;
    size: number;
    style?: object;
  },
) => React.ReactNode;

export type MarkdownComponent = React.ComponentType<{
  children: React.ReactNode;
  style?: object;
}>;

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  created_at: string;
  chat_id: string;
  profile_id: string;
  focus_ids: string[] | null;
  focus_items: Array<{ id: string; text: string }> | null;
  reasoning?: string | null;
  toolCalls: RpcChatMessage['toolCalls'];
  isStreaming?: boolean;
}
