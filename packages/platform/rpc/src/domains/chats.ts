import type { RawHonoClient } from '../core/raw-client';
import type {
  Chat,
  ChatsCreateOutput,
  ChatsGetMessagesOutput,
  ChatsGetOutput,
  ChatsUpdateOutput,
} from '../types/chat.types';

export interface ChatsCreateParams {
  title: string;
  noteId?: string;
}

export interface ChatsListInput {
  limit?: number;
}

export interface ChatsGetMessagesInput {
  chatId: string;
  limit?: number;
  offset?: number;
}

export interface ChatsSendMessageInput {
  chatId: string;
  message: string;
  fileIds?: string[];
  noteIds?: string[];
}

export interface ChatsArchiveInput {
  chatId: string;
}

export interface ChatsUpdateInput {
  chatId: string;
  title: string;
}

function toMessageQuery(input: ChatsGetMessagesInput): Record<string, string> {
  const query: Record<string, string> = {};

  if (typeof input.limit === 'number') {
    query.limit = String(input.limit);
  }
  if (typeof input.offset === 'number') {
    query.offset = String(input.offset);
  }

  return query;
}

export interface ChatsGetInput {
  chatId: string;
}

export interface ChatsClient {
  list(input: ChatsListInput): Promise<Chat[]>;
  get(input: ChatsGetInput): Promise<ChatsGetOutput>;
  getMessages(input: ChatsGetMessagesInput): Promise<ChatsGetMessagesOutput>;
  create(input: ChatsCreateParams): Promise<ChatsCreateOutput>;
  update(input: ChatsUpdateInput): Promise<ChatsUpdateOutput>;
  archive(input: ChatsArchiveInput): Promise<Chat>;
  stream(input: ChatsSendMessageInput): Promise<ReadableStream<Uint8Array>>;
}

export function createChatsClient(client: RawHonoClient): ChatsClient {
  return {
    async list(input) {
      const query: Record<string, string> = {};
      if (typeof input.limit === 'number') {
        query.limit = String(input.limit);
      }
      const res = await client.get('/api/chats', { query });
      return res.json() as Promise<Chat[]>;
    },
    async get(input) {
      const res = await client.get(`/api/chats/${input.chatId}`);
      return res.json() as Promise<ChatsGetOutput>;
    },
    async getMessages(input) {
      const res = await client.get(`/api/chats/${input.chatId}/messages`, {
        query: toMessageQuery(input),
      });
      return res.json() as Promise<ChatsGetMessagesOutput>;
    },
    async create(input) {
      const res = await client.post('/api/chats', { json: input });
      return res.json() as Promise<ChatsCreateOutput>;
    },
    async update(input) {
      const res = await client.patch(`/api/chats/${input.chatId}`, {
        json: { title: input.title },
      });
      return res.json() as Promise<ChatsUpdateOutput>;
    },
    async archive(input) {
      const res = await client.post(`/api/chats/${input.chatId}/archive`);
      return res.json() as Promise<Chat>;
    },
    async stream(input) {
      const res = await client.post(`/api/chats/${input.chatId}/stream`, {
        json: {
          message: input.message,
          ...(input.fileIds && input.fileIds.length > 0 ? { fileIds: input.fileIds } : {}),
          ...(input.noteIds && input.noteIds.length > 0 ? { noteIds: input.noteIds } : {}),
        },
      });
      if (res.body) {
        return res.body;
      }

      // response.body is null; buffer via .text() and wrap as a stream
      const text = await res.text();
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(text));
          controller.close();
        },
      });
    },
  };
}
