import type { ChatMessageFileRecord } from '@hominem/db/chats';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOwned = vi.fn();
const getStorageKey = vi.fn();
const getFileByPath = vi.fn();

vi.mock('@hominem/db/core', () => ({ db: {} }));
vi.mock('@hominem/db/files', () => ({ FileRepository: { getOwned, getStorageKey } }));
vi.mock('@hominem/storage', () => ({ fileStorageService: { getFileByPath } }));
vi.mock('@hominem/telemetry', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const { attachImagesToLastUserMessage, awaitDocumentAnalysis } =
  await import('./chat-generation-attachments');

const image: ChatMessageFileRecord = {
  type: 'image',
  fileId: 'img-1',
  url: 'https://example.test/img-1',
  filename: 'IMG_0005.jpg',
  mimeType: 'image/jpeg',
  size: 3,
};

const pdf: ChatMessageFileRecord = {
  type: 'file',
  fileId: 'doc-1',
  url: 'https://example.test/doc-1',
  filename: 'notes.pdf',
  mimeType: 'application/pdf',
  size: 10,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('attachImagesToLastUserMessage', () => {
  it('turns the last user turn into text plus the image as a data URI', async () => {
    getStorageKey.mockResolvedValue('u/img-1');
    getFileByPath.mockResolvedValue(Buffer.from([1, 2, 3]));

    const result = await attachImagesToLastUserMessage(
      [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'what is this?' },
      ],
      [image],
      'user-1',
    );

    expect(result.at(-1)).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'what is this?' },
        { type: 'image_url', imageUrl: { url: 'data:image/jpeg;base64,AQID' } },
      ],
    });
    expect(result[0]).toEqual({ role: 'system', content: 'sys' });
  });

  it('leaves messages alone when there is no image to send', async () => {
    const messages = [{ role: 'user' as const, content: 'hi' }];
    expect(await attachImagesToLastUserMessage(messages, [pdf], 'user-1')).toBe(messages);
  });

  it('skips an image whose bytes are missing instead of failing the chat', async () => {
    getStorageKey.mockResolvedValue('u/img-1');
    getFileByPath.mockResolvedValue(null);
    const messages = [{ role: 'user' as const, content: 'hi' }];
    expect(await attachImagesToLastUserMessage(messages, [image], 'user-1')).toBe(messages);
  });
});

describe('awaitDocumentAnalysis', () => {
  it('waits until the worker has written the extracted text', async () => {
    getOwned
      .mockResolvedValueOnce({ id: 'doc-1' })
      .mockResolvedValueOnce({ id: 'doc-1', textContent: 'quarterly numbers' });

    const [file] = await awaitDocumentAnalysis([pdf], 'user-1', { timeoutMs: 1_000, pollMs: 1 });

    expect(file?.metadata).toEqual({ extractedText: 'quarterly numbers' });
    expect(getOwned).toHaveBeenCalledTimes(2);
  });

  it('gives up on timeout and returns the file as it was', async () => {
    getOwned.mockResolvedValue({ id: 'doc-1' });

    const [file] = await awaitDocumentAnalysis([pdf], 'user-1', { timeoutMs: 5, pollMs: 1 });

    expect(file).toEqual(pdf);
  });

  it('does not wait on images or files that already have text', async () => {
    const withText = { ...pdf, metadata: { extractedText: 'already here' } };
    await awaitDocumentAnalysis([image, withText], 'user-1', { timeoutMs: 5, pollMs: 1 });
    expect(getOwned).not.toHaveBeenCalled();
  });
});
