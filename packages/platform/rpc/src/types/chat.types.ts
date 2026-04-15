import * as z from 'zod';

export type {
  ArtifactType,
  CaptureBarProps,
  Chat,
  ChatInsert,
  ChatIconName,
  ChatInput,
  ChatMessage,
  ChatMessageFile,
  ChatMessageInput,
  ChatMessageItem,
  ChatMessageOutput,
  ChatMessageReferencedNote,
  ChatMessageRole,
  ChatMessageToolCall,
  ChatOutput,
  MarkdownComponent,
  ReviewItem,
  SessionSource,
  ThoughtLifecycleState,
  ThoughtLifecycleTransition,
  JsonPrimitive,
  JsonValue,
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
  ChatMessageReferencedNote,
  ChatMessageRole,
  ChatMessageToolCall,
  JsonValue,
} from '@hominem/chat/types';

// ============================================================================
export interface ChatMessageFileDto {
  type: 'image' | 'file';
  fileId?: string;
  url?: string;
  filename?: string;
  mimeType?: string;
  size?: number;
  metadata?: Record<string, JsonValue>;
}

export interface ChatMessageDto {
  id: string;
  chatId: string;
  userId: string;
  role: ChatMessageRole;
  content: string;
  files: ChatMessageFileDto[] | null;
  referencedNotes: ChatMessageReferencedNote[] | null;
  toolCalls: ChatMessageToolCall[] | null;
  reasoning: string | null;
  parentMessageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ChatWithMessages = Chat & {
  messages: ChatMessageDto[];
};

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

export type ChatsSendOutput = {
  assistantMessageId: string;
  chatId: string;
  chatTitle: string;
  messages: {
    user: ChatMessageDto;
    assistant: ChatMessageDto;
  };
  metadata: {
    startTime: number;
    timestamp: string;
  };
};

export type ChatsCreateInput = {
  title: string;
};

export type ChatsArchiveOutput = Chat;

// ============================================================================
// Output Types (Inferred from returns - these are optional aliases)
// ============================================================================

export type ChatsListOutput = Chat[];
export type ChatsGetOutput = ChatWithMessages;
export type ChatsCreateOutput = Chat;
export type ChatsUpdateOutput = { success: boolean };
export type ChatsDeleteOutput = { success: boolean };
export type ChatsGetMessagesOutput = ChatMessageDto[];

// ============================================================================
// CLASSIFY (thought → artifact review)
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
