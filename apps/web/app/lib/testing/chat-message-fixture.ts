import type { ChatMessageDto } from '@hominem/rpc/types/chat.types';

export function makeChatMessageDto(overrides: Partial<ChatMessageDto> = {}): ChatMessageDto {
  return {
    id: 'message-1',
    chatId: 'chat-1',
    userId: 'user-1',
    role: 'assistant',
    content: '',
    files: null,
    toolCalls: null,
    reasoning: null,
    parentMessageId: null,
    createdAt: '2026-08-24T17:30:00.000Z',
    updatedAt: '2026-08-24T17:30:00.000Z',
    ...overrides,
  };
}
