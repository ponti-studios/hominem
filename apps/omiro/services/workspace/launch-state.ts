import type { WorkspaceResumeArtifact } from './routes';

const FEED_DRAFT_KEY = 'workspace-feed-draft-v1';
const CHAT_DRAFT_PREFIX = 'workspace-chat-draft-v1:';
const RESUME_ARTIFACT_KEY = 'workspace-resume-artifact-v1';

const memoryStorage = new Map<string, string>();

let hasAttemptedWorkspaceRestore = false;

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
    const { storage } =
      require('~/services/storage/mmkv') as typeof import('~/services/storage/mmkv');
    return storage;
  } catch {
    return getFallbackStorage();
  }
}

function getChatDraftKey(chatId: string) {
  return `${CHAT_DRAFT_PREFIX}${chatId}`;
}

function readJSONValue<T>(key: string): T | null {
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

function writeJSONValue<T>(key: string, value: T) {
  getStorage().set(key, JSON.stringify(value));
}

export function readFeedDraft(): string {
  return getStorage().getString(FEED_DRAFT_KEY) ?? '';
}

export function writeFeedDraft(value: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    getStorage().remove(FEED_DRAFT_KEY);
    return;
  }

  getStorage().set(FEED_DRAFT_KEY, value);
}

export function clearFeedDraft() {
  getStorage().remove(FEED_DRAFT_KEY);
}

export function readChatDraft(chatId: string): string {
  return getStorage().getString(getChatDraftKey(chatId)) ?? '';
}

export function writeChatDraft(chatId: string, value: string) {
  const normalized = value.trim();
  const key = getChatDraftKey(chatId);
  if (normalized.length === 0) {
    getStorage().remove(key);
    return;
  }

  getStorage().set(key, value);
}

export function clearChatDraft(chatId: string) {
  getStorage().remove(getChatDraftKey(chatId));
}

export function writeWorkspaceResumeArtifact(artifact: WorkspaceResumeArtifact) {
  writeJSONValue(RESUME_ARTIFACT_KEY, artifact);
}

export function readWorkspaceResumeArtifact(): WorkspaceResumeArtifact | null {
  return readJSONValue<WorkspaceResumeArtifact>(RESUME_ARTIFACT_KEY);
}

export function clearWorkspaceResumeArtifact() {
  getStorage().remove(RESUME_ARTIFACT_KEY);
}

export function consumeWorkspaceRestoreAttempt(): boolean {
  if (hasAttemptedWorkspaceRestore) {
    return false;
  }

  hasAttemptedWorkspaceRestore = true;
  return true;
}
