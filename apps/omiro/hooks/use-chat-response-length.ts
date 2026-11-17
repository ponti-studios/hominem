import {
  DEFAULT_REPLY_LENGTH,
  normalizeReplyLength,
  REPLY_LENGTH_IDS,
  type ReplyLengthId,
} from '@hominem/ai/reply-profile';
import { useSyncExternalStore } from 'react';

import { storage, subscribeToStorageKey } from '~/services/storage/mmkv';

export type ChatResponseLength = ReplyLengthId;

export const CHAT_RESPONSE_LENGTHS: readonly ChatResponseLength[] = REPLY_LENGTH_IDS;

const RESPONSE_LENGTH_KEY = 'chat_response_length';

// Reads a stored value through the shared normalizer, so a value saved as short, medium, or long
// by an older build still resolves to its current level.
export function getChatResponseLength(): ChatResponseLength {
  return normalizeReplyLength(storage.getString(RESPONSE_LENGTH_KEY)) ?? DEFAULT_REPLY_LENGTH;
}

export function setChatResponseLength(value: ChatResponseLength) {
  storage.set(RESPONSE_LENGTH_KEY, value);
}

export function useChatResponseLength() {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToStorageKey(RESPONSE_LENGTH_KEY, onStoreChange),
    getChatResponseLength,
    getChatResponseLength,
  );
}
