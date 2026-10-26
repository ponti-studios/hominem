import type { ChatMessageSnapshot, ChatMessageToolCallRecord } from './generation-schemas';

export type { ChatMessageFileRecord, ChatMessageToolCallRecord } from './generation-schemas';

export interface ChatMessageItem {
  id: string;
  // Stable id for list rendering that survives server reconciliation
  renderKey?: string;
  role: Exclude<ChatMessageSnapshot['role'], 'tool'>;
  message: string;
  createdAt: string;
  chatId: string;
  reasoning?: string | null;
  toolCalls: ChatMessageToolCallRecord[] | null;
  isStreaming?: boolean;
  audio?: { url: string; mimeType: string } | null;
  // Photos sent with a user message. `url` is a local file:// uri for a message still
  // sending, and the API's signed read url once the server's copy is loaded.
  images?: { id: string; url: string }[];
  // Set when a send fails or a stream gets interrupted, instead of removing
  // the message — keeps it visible in the transcript so the user can retry
  failed?: boolean;
  error?: string | null;
}

export type MarkdownComponent = import('react').ComponentType<{
  children: import('react').ReactNode;
  style?: object;
}>;
