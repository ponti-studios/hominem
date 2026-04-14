import { createChatsClient, type ChatsClient } from '../domains/chats';
import { createFilesClient, type FilesClient } from '../domains/files';
import { createNotesClient, type NotesClient } from '../domains/notes';
import { createTasksClient, type TasksClient } from '../domains/tasks';
import { createVoiceClient, type VoiceClient } from '../domains/voice';
import { createRawHonoClient, type RawHonoClient } from './raw-client';

export interface ClientConfig {
  baseUrl: string;
  getHeaders?: () => Promise<Record<string, string>>;
  onError?: (error: Error) => void;
}

export interface ApiClient {
  chats: ChatsClient;
  files: FilesClient;
  notes: NotesClient;
  tasks: TasksClient;
  voice: VoiceClient;
}

export function createApiClientFromRaw(rawClient: RawHonoClient): ApiClient {
  return {
    chats: createChatsClient(rawClient),
    files: createFilesClient(rawClient),
    notes: createNotesClient(rawClient),
    tasks: createTasksClient(rawClient),
    voice: createVoiceClient(rawClient),
  };
}

export function createApiClient(config: ClientConfig): ApiClient {
  const rawClient = createRawHonoClient(config);
  return createApiClientFromRaw(rawClient);
}

export function createClient(config: ClientConfig): ApiClient {
  return createApiClient(config);
}

export function createHonoClient(config: ClientConfig): ApiClient {
  return createApiClient(config);
}
