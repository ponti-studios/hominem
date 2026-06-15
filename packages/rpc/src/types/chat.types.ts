import type { InferResponseType } from 'hono/client';

export type {
  ArtifactType,
  CaptureBarProps,
  Chat,
  ChatIconName,
  ChatInput,
  ChatInsert,
  ChatMessage,
  ChatMessageFile,
  ChatMessageInput,
  ChatMessageItem,
  ChatMessageOutput,
  ChatMessageReferencedNote,
  ChatMessageRole,
  ChatMessageToolCall,
  ChatOutput,
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

import type {
  ArtifactType,
  Chat,
} from '@hominem/chat/types';

import type { HonoClient } from '../core/api-client';

// ============================================================================
type _MessagesEndpoint = HonoClient['api']['chats'][':id']['messages']['$get'];
export type ChatMessageDto = InferResponseType<_MessagesEndpoint, 200>[number];
export type ChatMessageFileDto = NonNullable<ChatMessageDto['files']>[number];

export type ChatWithMessages = Chat & { messages: ChatMessageDto[] };

// ============================================================================
// SEND MESSAGE
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


export type ChatsCreateInput = {
  title: string;
};

type _ChatsCreateEndpoint = HonoClient['api']['chats']['$post'];
export type ChatsCreateOutput = InferResponseType<_ChatsCreateEndpoint, 201>;

type _ChatsArchiveEndpoint = HonoClient['api']['chats'][':id']['archive']['$post'];
export type ChatsArchiveOutput = InferResponseType<_ChatsArchiveEndpoint, 200>;

// ============================================================================
// Output Types (Inferred from returns - these are optional aliases)
// ============================================================================

export type ChatsListOutput = Chat[];
export type ChatsGetOutput = ChatWithMessages;
export type ChatsUpdateOutput = { success: boolean };
export type ChatsDeleteOutput = { success: boolean };
export type ChatsGetMessagesOutput = ChatMessageDto[];

// ============================================================================
// CLASSIFY (capture → artifact review)
// ============================================================================

export type ChatsClassifyOutput = {
  targetType: ArtifactType;
  proposedType: ArtifactType;
  proposedTitle: string;
  proposedChanges: string[];
  previewContent: string;
  reviewItemId: string;
};

export type ChatsClassifyInput = {
  targetType: ArtifactType;
};

// ============================================================================
// MESSAGES OPERATIONS
// ============================================================================

export type MessagesGetOutput = { message: ChatMessageDto };

export type MessagesUpdateInput = {
  content: string;
};

export type MessagesUpdateOutput = { message: ChatMessageDto };

export type MessagesDeleteOutput = { success: boolean };

export type MessagesDeleteAfterInput = {
  chatId: string;
  afterTimestamp: string;
};

export type MessagesDeleteAfterOutput = { deletedCount: number };
