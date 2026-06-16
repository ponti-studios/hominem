import type { InferRequestType, InferResponseType } from 'hono/client';

export type {
  ArtifactType,
  CaptureBarProps,
  ChatIconName,
  ChatMessageItem,
  ChatMessageReferencedNote,
  ChatMessageRole,
  ChatMessageToolCall,
  JsonPrimitive,
  JsonValue,
  MarkdownComponent,
  ReviewItem,
  SessionSource,
  CaptureLifecycleState,
  CaptureLifecycleTransition,
} from '@hominem/chat/types';

export {
  CHAT_TITLE_MAX_LENGTH,
  ENABLED_ARTIFACT_TYPES,
  getReferencedNoteLabel,
  isArtifactTypeEnabled,
} from '@hominem/chat/types';

import type { HonoClient } from '../core/api-client';

// ============================================================================
// LIST
// ============================================================================

type _ChatsListEndpoint = HonoClient['api']['chats']['$get'];
export type ChatsListOutput = InferResponseType<_ChatsListEndpoint, 200>;
export type Chat = ChatsListOutput[number];

// ============================================================================
// CREATE
// ============================================================================

type _ChatsCreateEndpoint = HonoClient['api']['chats']['$post'];
export type ChatsCreateInput = InferRequestType<_ChatsCreateEndpoint>['json'];
export type ChatsCreateOutput = InferResponseType<_ChatsCreateEndpoint, 201>;

// ============================================================================
// GET (with messages)
// ============================================================================

type _ChatsGetEndpoint = HonoClient['api']['chats'][':id']['$get'];
export type ChatsGetOutput = InferResponseType<_ChatsGetEndpoint, 200>;
export type ChatMessageDto = ChatsGetOutput['messages'][number];
export type ChatMessageFileDto = NonNullable<ChatMessageDto['files']>[number];
export type ChatMessage = ChatMessageDto;
export type ChatMessageFile = ChatMessageFileDto;
export type ChatWithMessages = Chat & { messages: ChatMessageDto[] };

// ============================================================================
// UPDATE
// ============================================================================

type _ChatsUpdateEndpoint = HonoClient['api']['chats'][':id']['$patch'];
export type ChatsUpdateInput = InferRequestType<_ChatsUpdateEndpoint>['json'];
export type ChatsUpdateOutput = InferResponseType<_ChatsUpdateEndpoint, 200>;

// ============================================================================
// ARCHIVE
// ============================================================================

type _ChatsArchiveEndpoint = HonoClient['api']['chats'][':id']['archive']['$post'];
export type ChatsArchiveOutput = InferResponseType<_ChatsArchiveEndpoint, 200>;

// ============================================================================
// MESSAGES
// ============================================================================

type _ChatsMessagesEndpoint = HonoClient['api']['chats'][':id']['messages']['$get'];
export type ChatsGetMessagesOutput = InferResponseType<_ChatsMessagesEndpoint, 200>;

// ============================================================================
// STREAM (send message) — chatId is a client-side routing concern, not in the route body
// ============================================================================

export type ChatsSendInput = {
  message: string;
  fileIds?: string[];
  noteIds?: string[];
  chatId?: string;
};

export type ChatUIMessageInput = {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'data';
  content: string;
  parts?: Array<Record<string, unknown>>;
  toolInvocations?: Array<Record<string, unknown>>;
  createdAt?: string | Date;
};

export type ChatsUISendInput = {
  messages: ChatUIMessageInput[];
  chatId?: string;
  metadata?: Record<string, unknown>;
};
