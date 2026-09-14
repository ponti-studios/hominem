import { storage } from '~/services/storage/mmkv';

import type { ResumeTarget } from './routes';

const ALL_DRAFT_KEY = 'workspace-feed-draft-v1';
const NEW_CHAT_DRAFT_KEY = 'workspace-new-chat-draft-v1';
const CHAT_DRAFT_PREFIX = 'workspace-chat-draft-v1:';
const RESUME_TARGET_KEY = 'workspace-resume-artifact-v1';

function getChatDraftKey(chatId: string) {
  return `${CHAT_DRAFT_PREFIX}${chatId}`;
}

function readJSONValue<T>(key: string): T | null {
  const raw = storage.getString(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    storage.remove(key);
    return null;
  }
}

function writeJSONValue<T>(key: string, value: T) {
  storage.set(key, JSON.stringify(value));
}

function readDraft(key: string): string {
  return storage.getString(key) ?? '';
}

function writeDraft(key: string, value: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    storage.remove(key);
    return;
  }

  storage.set(key, value);
}

function clearDraft(key: string) {
  storage.remove(key);
}

export function readAllDraft(): string {
  return readDraft(ALL_DRAFT_KEY);
}

export function writeAllDraft(value: string) {
  writeDraft(ALL_DRAFT_KEY, value);
}

export function clearAllDraft() {
  clearDraft(ALL_DRAFT_KEY);
}

export function readNewChatDraft(): string {
  return readDraft(NEW_CHAT_DRAFT_KEY);
}

export function writeNewChatDraft(value: string) {
  writeDraft(NEW_CHAT_DRAFT_KEY, value);
}

export function clearNewChatDraft() {
  clearDraft(NEW_CHAT_DRAFT_KEY);
}

export function readChatDraft(chatId: string): string {
  return readDraft(getChatDraftKey(chatId));
}

export function writeChatDraft(chatId: string, value: string) {
  writeDraft(getChatDraftKey(chatId), value);
}

export function clearChatDraft(chatId: string) {
  clearDraft(getChatDraftKey(chatId));
}

export function writeResumeTarget(target: ResumeTarget) {
  writeJSONValue(RESUME_TARGET_KEY, target);
}

export function readResumeTarget(): ResumeTarget | null {
  return readJSONValue<ResumeTarget>(RESUME_TARGET_KEY);
}

export function clearResumeTarget() {
  storage.remove(RESUME_TARGET_KEY);
}

export function consumeResumeTarget(): ResumeTarget | null {
  const target = readResumeTarget();
  if (!target) {
    return null;
  }

  clearResumeTarget();
  return target;
}

let hasAttemptedRestore = false;
export function consumeRestoreAttempt(): boolean {
  if (hasAttemptedRestore) {
    return false;
  }

  hasAttemptedRestore = true;
  return true;
}
