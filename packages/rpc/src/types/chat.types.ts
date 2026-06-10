import * as z from 'zod';
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

export const chatsSendSchema = z
  .object({
    message: z.string(),
    fileIds: z.array(z.uuid()).max(5).optional(),
    noteIds: z.array(z.uuid()).max(10).optional(),
    chatId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.message.trim().length === 0 &&
      (!value.fileIds || value.fileIds.length === 0) &&
      (!value.noteIds || value.noteIds.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'message, fileIds, or noteIds is required',
        path: ['message'],
      });
    }
  });

export const chatsUISendSchema = z.object({
  messages: z.array(
    z.object({
      id: z.string(),
      role: z.enum(['system', 'user', 'assistant', 'data']),
      content: z.string(),
      parts: z.array(z.record(z.string(), z.unknown())).optional(),
      toolInvocations: z.array(z.record(z.string(), z.unknown())).optional(),
      createdAt: z.union([z.string(), z.date()]).optional(),
    }),
  ),
  chatId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

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
