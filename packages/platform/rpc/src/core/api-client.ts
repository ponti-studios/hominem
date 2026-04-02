import { createChatsClient, type ChatsClient } from '../domains/chats';
import { createFilesClient, type FilesClient } from '../domains/files';
import { createFocusClient, type FocusClient } from '../domains/focus';
import { createMessagesClient, type MessagesClient } from '../domains/messages';
import { createMobileClient, type MobileClient } from '../domains/mobile';
import { createNotesClient, type NotesClient } from '../domains/notes';
import { createReviewClient, type ReviewClient } from '../domains/review';
import { createVoiceClient, type VoiceClient } from '../domains/voice';
import { createRawHonoClient, type RawHonoClient } from './raw-client';

export interface ClientConfig {
  baseUrl: string;
  getAuthToken: () => Promise<string | null>;
  getHeaders?: () => Promise<Record<string, string>>;
  onError?: (error: Error) => void;
}

export interface ApiClient {
  chats: ChatsClient;
  files: FilesClient;
  focus: FocusClient;
  messages: MessagesClient;
  mobile: MobileClient;
  notes: NotesClient;
  review: ReviewClient;
  voice: VoiceClient;
}

export function createApiClientFromRaw(rawClient: RawHonoClient): ApiClient {
  return {
    chats: createChatsClient(rawClient),
    files: createFilesClient(rawClient),
    focus: createFocusClient(rawClient),
    messages: createMessagesClient(rawClient),
    mobile: createMobileClient(rawClient),
    notes: createNotesClient(rawClient),
    review: createReviewClient(rawClient),
    voice: createVoiceClient(rawClient),
  };
}

export function createApiClient(config: ClientConfig): ApiClient {
  const rawClient = createRawHonoClient(config);
  return createApiClientFromRaw(rawClient);
}

export const createClient = createApiClient;
export const createHonoClient = createClient;
