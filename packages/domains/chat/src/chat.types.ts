export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ChatMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessageReferencedNote {
  id: string;
  title: string | null;
}

export interface ChatMessageToolCall {
  toolName: string;
  type: 'tool-call';
  toolCallId: string;
  args: Record<string, string>;
}

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
  referencedNotes: ChatMessageReferencedNote[] | null;
  toolCalls: ChatMessageToolCall[] | null;
  isStreaming?: boolean;
}

export interface ChatMessageFile {
  type: 'image' | 'file';
  filename?: string;
  mimeType?: string;
  size?: number;
  metadata?: Record<string, JsonValue>;
}

export interface Chat {
  archivedAt: string | null;
  id: string;
  userId: string;
  title: string;
  noteId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatInsert {
  archivedAt?: string | null;
  id?: string;
  userId: string;
  title?: string;
  noteId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  files: ChatMessageFile[] | null;
  toolCalls: ChatMessageToolCall[] | null;
  reasoning: string | null;
  parentMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageInsert {
  id?: string;
  chatId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  files?: ChatMessageFile[] | null;
  toolCalls?: ChatMessageToolCall[] | null;
  reasoning?: string | null;
  parentMessageId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export function getReferencedNoteLabel(note: ChatMessageReferencedNote) {
  return note.title || note.id;
}

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
) => import('react').ReactNode;

export type MarkdownComponent = import('react').ComponentType<{
  children: import('react').ReactNode;
  style?: object;
}>;

export type ChatOutput = Chat;
export type ChatInput = ChatInsert;
export type ChatMessageOutput = ChatMessage;
export type ChatMessageInput = ChatMessageInsert;
