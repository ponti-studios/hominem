import { DEFAULT_REPLY_MODEL, isReplyModelId } from '@hominem/ai/reply-models';
import { DEFAULT_REPLY_STYLE, REPLY_STYLE_IDS, type ReplyStyleId } from '@hominem/ai/reply-profile';
import { useSyncExternalStore } from 'react';

import { storage, subscribeToStorageKey } from '~/services/storage/mmkv';

export type ChatReplyPrefs = { replyStyle: ReplyStyleId; replyModel: string };

const REPLY_STYLE_KEY = 'chat_reply_style';
const REPLY_MODEL_KEY = 'chat_reply_model';

export const CHAT_REPLY_STYLES = REPLY_STYLE_IDS;

function isReplyStyleId(value: string | undefined): value is ReplyStyleId {
  return REPLY_STYLE_IDS.some((id) => id === value);
}

function getChatReplyStyle(): ReplyStyleId {
  const stored = storage.getString(REPLY_STYLE_KEY);
  return isReplyStyleId(stored) ? stored : DEFAULT_REPLY_STYLE;
}

export function setChatReplyStyle(value: ReplyStyleId) {
  storage.set(REPLY_STYLE_KEY, value);
}

function getChatReplyModel(): string {
  const stored = storage.getString(REPLY_MODEL_KEY);
  return stored && isReplyModelId(stored) ? stored : DEFAULT_REPLY_MODEL;
}

export function setChatReplyModel(value: string) {
  storage.set(REPLY_MODEL_KEY, value);
}

/** The reply preferences a request carries. Spread into every send, retry, and regenerate body. */
export function getChatReplyPrefs(): ChatReplyPrefs {
  return { replyStyle: getChatReplyStyle(), replyModel: getChatReplyModel() };
}

export function useChatReplyStyle() {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToStorageKey(REPLY_STYLE_KEY, onStoreChange),
    getChatReplyStyle,
    getChatReplyStyle,
  );
}

export function useChatReplyModel() {
  return useSyncExternalStore(
    (onStoreChange) => subscribeToStorageKey(REPLY_MODEL_KEY, onStoreChange),
    getChatReplyModel,
    getChatReplyModel,
  );
}
