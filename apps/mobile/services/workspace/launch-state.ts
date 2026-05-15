import { storage } from '~/services/storage/mmkv';

const FEED_DRAFT_KEY = 'workspace-feed-draft-v1';
const CHAT_DRAFT_PREFIX = 'workspace-chat-draft-v1:';
const LAST_OPEN_ROUTE_KEY = 'workspace-last-open-route-v1';

let hasAttemptedWorkspaceRestore = false;

function getChatDraftKey(chatId: string) {
  return `${CHAT_DRAFT_PREFIX}${chatId}`;
}

export function readFeedDraft(): string {
  return storage.getString(FEED_DRAFT_KEY) ?? '';
}

export function writeFeedDraft(value: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    storage.remove(FEED_DRAFT_KEY);
    return;
  }

  storage.set(FEED_DRAFT_KEY, value);
}

export function clearFeedDraft() {
  storage.remove(FEED_DRAFT_KEY);
}

export function readChatDraft(chatId: string): string {
  return storage.getString(getChatDraftKey(chatId)) ?? '';
}

export function writeChatDraft(chatId: string, value: string) {
  const normalized = value.trim();
  const key = getChatDraftKey(chatId);
  if (normalized.length === 0) {
    storage.remove(key);
    return;
  }

  storage.set(key, value);
}

export function clearChatDraft(chatId: string) {
  storage.remove(getChatDraftKey(chatId));
}

export function writeLastOpenWorkspaceRoute(route: string) {
  storage.set(LAST_OPEN_ROUTE_KEY, route);
}

export function readLastOpenWorkspaceRoute(): string | null {
  return storage.getString(LAST_OPEN_ROUTE_KEY) ?? null;
}

export function consumeWorkspaceRestoreAttempt(): boolean {
  if (hasAttemptedWorkspaceRestore) {
    return false;
  }

  hasAttemptedWorkspaceRestore = true;
  return true;
}
