import type { Chat, Note } from '@hominem/rpc/types';

import type { MessageOutput } from '~/services/chat/chatMessages';

const NOTE_CACHE_PREFIX = 'workspace-note-cache-v1:';
const CHAT_CACHE_PREFIX = 'workspace-chat-cache-v1:';
const CHAT_MESSAGES_CACHE_PREFIX = 'workspace-chat-messages-cache-v1:';

const memoryStorage = new Map<string, string>();

interface StorageLike {
  getString: (key: string) => string | undefined;
  remove: (key: string) => void;
  set: (key: string, value: string) => void;
}

function getFallbackStorage(): StorageLike {
  return {
    getString: (key) => memoryStorage.get(key),
    remove: (key) => {
      memoryStorage.delete(key);
    },
    set: (key, value) => {
      memoryStorage.set(key, value);
    },
  };
}

function getStorage(): StorageLike {
  try {
    const { storage } = require('../storage/mmkv') as typeof import('../storage/mmkv');
    return storage;
  } catch {
    return getFallbackStorage();
  }
}

function getNoteCacheKey(noteId: string) {
  return `${NOTE_CACHE_PREFIX}${noteId}`;
}

function getChatCacheKey(chatId: string) {
  return `${CHAT_CACHE_PREFIX}${chatId}`;
}

function getChatMessagesCacheKey(chatId: string) {
  return `${CHAT_MESSAGES_CACHE_PREFIX}${chatId}`;
}

function readCachedValue<T>(key: string): T | null {
  const raw = getStorage().getString(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    getStorage().remove(key);
    return null;
  }
}

function writeCachedValue<T>(key: string, value: T) {
  getStorage().set(key, JSON.stringify(value));
}

export function readCachedNote(noteId: string): Note | null {
  return readCachedValue<Note>(getNoteCacheKey(noteId));
}

export function writeCachedNote(note: Note) {
  writeCachedValue(getNoteCacheKey(note.id), note);
}

export function clearCachedNote(noteId: string) {
  getStorage().remove(getNoteCacheKey(noteId));
}

export function readCachedChat(chatId: string): Chat | null {
  return readCachedValue<Chat>(getChatCacheKey(chatId));
}

export function writeCachedChat(chat: Chat) {
  writeCachedValue(getChatCacheKey(chat.id), chat);
}

export function readCachedChatMessages(chatId: string): MessageOutput[] {
  return readCachedValue<MessageOutput[]>(getChatMessagesCacheKey(chatId)) ?? [];
}

export function writeCachedChatMessages(chatId: string, messages: MessageOutput[]) {
  writeCachedValue(getChatMessagesCacheKey(chatId), messages);
}
