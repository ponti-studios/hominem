import type { UploadedFile } from '~/types/upload';

import type { WorkspaceResumeArtifact } from './routes';

const FEED_DRAFT_KEY = 'workspace-feed-draft-v1';
const CHAT_DRAFT_PREFIX = 'workspace-chat-draft-v1:';
const CHAT_COMPOSER_HANDOFF_PREFIX = 'workspace-chat-composer-handoff-v1:';
const RESUME_ARTIFACT_KEY = 'workspace-resume-artifact-v1';

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
    const { storage } =
      require('~/services/storage/mmkv') as typeof import('~/services/storage/mmkv'); // eslint-disable-line @typescript-eslint/no-require-imports
    return storage;
  } catch {
    return getFallbackStorage();
  }
}

function getChatDraftKey(chatId: string) {
  return `${CHAT_DRAFT_PREFIX}${chatId}`;
}

function getChatComposerHandoffKey(chatId: string) {
  return `${CHAT_COMPOSER_HANDOFF_PREFIX}${chatId}`;
}

interface SerializedUploadedFile extends Omit<UploadedFile, 'uploadedAt'> {
  uploadedAt: string;
}

export interface WorkspaceChatComposerAttachment {
  id: string;
  name: string;
  type: string;
  localUri?: string;
  uploadedFile?: UploadedFile;
}

interface SerializedWorkspaceChatComposerAttachment extends Omit<
  WorkspaceChatComposerAttachment,
  'uploadedFile'
> {
  uploadedFile?: SerializedUploadedFile;
}

export interface WorkspaceChatComposerHandoff {
  attachments: WorkspaceChatComposerAttachment[];
  message: string;
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

function serializeChatComposerAttachment(
  attachment: WorkspaceChatComposerAttachment,
): SerializedWorkspaceChatComposerAttachment {
  if (!attachment.uploadedFile) {
    return {
      id: attachment.id,
      localUri: attachment.localUri,
      name: attachment.name,
      type: attachment.type,
    };
  }

  return {
    id: attachment.id,
    localUri: attachment.localUri,
    name: attachment.name,
    type: attachment.type,
    uploadedFile: {
      ...attachment.uploadedFile,
      uploadedAt: attachment.uploadedFile.uploadedAt.toISOString(),
    },
  };
}

function deserializeChatComposerAttachment(
  attachment: SerializedWorkspaceChatComposerAttachment,
): WorkspaceChatComposerAttachment {
  if (!attachment.uploadedFile) {
    return {
      id: attachment.id,
      localUri: attachment.localUri,
      name: attachment.name,
      type: attachment.type,
    };
  }

  return {
    id: attachment.id,
    localUri: attachment.localUri,
    name: attachment.name,
    type: attachment.type,
    uploadedFile: {
      ...attachment.uploadedFile,
      uploadedAt: new Date(attachment.uploadedFile.uploadedAt),
    },
  };
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

export function writeChatComposerHandoff(chatId: string, handoff: WorkspaceChatComposerHandoff) {
  writeJSONValue(getChatComposerHandoffKey(chatId), {
    ...handoff,
    attachments: handoff.attachments.map(serializeChatComposerAttachment),
  });
}

export function readChatComposerHandoff(chatId: string): WorkspaceChatComposerHandoff | null {
  const handoff = readJSONValue<{
    attachments: SerializedWorkspaceChatComposerAttachment[];
    message: string;
  }>(getChatComposerHandoffKey(chatId));

  if (!handoff) {
    return null;
  }

  return {
    ...handoff,
    attachments: handoff.attachments.map(deserializeChatComposerAttachment),
  };
}

export function consumeChatComposerHandoff(chatId: string): WorkspaceChatComposerHandoff | null {
  const handoff = readChatComposerHandoff(chatId);
  if (!handoff) {
    return null;
  }

  getStorage().remove(getChatComposerHandoffKey(chatId));
  return handoff;
}

export function clearChatComposerHandoff(chatId: string) {
  getStorage().remove(getChatComposerHandoffKey(chatId));
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

export function consumeWorkspaceResumeArtifact(): WorkspaceResumeArtifact | null {
  const artifact = readWorkspaceResumeArtifact();
  if (!artifact) {
    return null;
  }

  clearWorkspaceResumeArtifact();
  return artifact;
}

let hasAttemptedWorkspaceRestore = false;
export function consumeWorkspaceRestoreAttempt(): boolean {
  if (hasAttemptedWorkspaceRestore) {
    return false;
  }

  hasAttemptedWorkspaceRestore = true;
  return true;
}
