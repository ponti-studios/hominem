import type { ChatMessages } from '@hominem/ai';
import type { ChatMessageFileRecord } from '@hominem/db/chats';
import { db } from '@hominem/db/core';
import { FileRepository } from '@hominem/db/files';
import { fileStorageService } from '@hominem/storage';
import { logger } from '@hominem/telemetry';
import { isObject } from '@hominem/utils';

// What the vision-capable chat models accept as image input.
const MODEL_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

// Same ceiling the one-shot image description uses; bigger files are skipped, not failed.
const MAX_MODEL_IMAGE_BYTES = 20 * 1024 * 1024;

// Documents whose text the worker extracts. Audio/video never get text, so never wait on them.
const TEXT_EXTRACTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
]);

export const DOCUMENT_ANALYSIS_TIMEOUT_MS = 15_000;
const DOCUMENT_ANALYSIS_POLL_MS = 500;

function hasExtractedText(file: ChatMessageFileRecord): boolean {
  return (
    isObject(file.metadata) &&
    typeof file.metadata.extractedText === 'string' &&
    file.metadata.extractedText.length > 0
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The upload is "ready" the moment /complete returns, but the worker extracts document text
// after that. Hold the send for a bit so the model gets the text instead of a bare filename.
// Gives up quietly on timeout: a slow or dead worker should not block the chat.
export async function awaitDocumentAnalysis(
  files: ChatMessageFileRecord[],
  userId: string,
  options: { timeoutMs?: number; pollMs?: number } = {},
): Promise<ChatMessageFileRecord[]> {
  const timeoutMs = options.timeoutMs ?? DOCUMENT_ANALYSIS_TIMEOUT_MS;
  const pollMs = options.pollMs ?? DOCUMENT_ANALYSIS_POLL_MS;
  const deadline = Date.now() + timeoutMs;

  const resolveOne = async (file: ChatMessageFileRecord): Promise<ChatMessageFileRecord> => {
    if (
      file.type !== 'file' ||
      !file.fileId ||
      !file.mimeType ||
      !TEXT_EXTRACTED_MIME_TYPES.has(file.mimeType) ||
      hasExtractedText(file)
    ) {
      return file;
    }
    for (;;) {
      const record = await FileRepository.getOwned(db, file.fileId, userId);
      if (record?.textContent) {
        return {
          ...file,
          metadata: { ...file.metadata, extractedText: record.textContent.slice(0, 4_000) },
        };
      }
      if (Date.now() + pollMs > deadline) {
        logger.warn('file_analysis_wait_timed_out', {
          operation: 'chat.attachments',
          fileId: file.fileId,
        });
        return file;
      }
      await sleep(pollMs);
    }
  };

  return Promise.all(files.map(resolveOne));
}

async function toImagePart(
  file: ChatMessageFileRecord,
  userId: string,
): Promise<{ type: 'image_url'; imageUrl: { url: string } } | null> {
  if (
    file.type !== 'image' ||
    !file.fileId ||
    !file.mimeType ||
    !MODEL_IMAGE_MIME_TYPES.has(file.mimeType)
  ) {
    return null;
  }
  try {
    const storageKey = await FileRepository.getStorageKey(db, file.fileId, userId);
    const bytes = storageKey ? await fileStorageService.getFileByPath(storageKey) : null;
    if (!bytes || bytes.byteLength >= MAX_MODEL_IMAGE_BYTES) return null;
    return {
      type: 'image_url',
      imageUrl: { url: `data:${file.mimeType};base64,${bytes.toString('base64')}` },
    };
  } catch (error) {
    logger.warn('chat_attachment_image_load_failed', {
      operation: 'chat.attachments',
      failureType: 'chat.attachments.image_load_failed',
      fileId: file.fileId,
      error,
    });
    return null;
  }
}

// Swap the last user turn's plain text for text + the actual images, so the model sees the
// photo and not just a description of it. Request-only: stored messages stay text.
export async function attachImagesToLastUserMessage(
  messages: ChatMessages[],
  files: ChatMessageFileRecord[],
  userId: string,
): Promise<ChatMessages[]> {
  const parts = (await Promise.all(files.map((file) => toImagePart(file, userId)))).filter(
    (part) => part !== null,
  );
  const last = messages.at(-1);
  if (parts.length === 0 || !last || last.role !== 'user' || typeof last.content !== 'string') {
    return messages;
  }
  return [
    ...messages.slice(0, -1),
    { ...last, content: [{ type: 'text', text: last.content }, ...parts] },
  ];
}
