import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getFileByPath: vi.fn(),
  processFile: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../lib/redis', () => ({
  cache: {},
}));

vi.mock('@hominem/db', () => ({
  getDb: mocks.getDb,
  FileRepository: {
    upsert: mocks.upsert,
  },
}));

vi.mock('@hominem/services/files', () => ({
  FileProcessorService: {
    processFile: mocks.processFile,
  },
}));

vi.mock('@hominem/utils/storage', () => ({
  fileStorageService: {
    getFileByPath: mocks.getFileByPath,
  },
}));

import { processFileUploadJob } from './file-processing';

describe('processFileUploadJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockReturnValue({ db: true });
    mocks.getFileByPath.mockResolvedValue(Buffer.from('file-bytes'));
    mocks.processFile.mockResolvedValue({
      content: 'Summary',
      textContent: 'Extracted text',
      metadata: { pages: 1 },
    });
  });

  it('processes the stored file and persists extracted content', async () => {
    await processFileUploadJob({
      jobId: 'job-1',
      userId: 'user-1',
      fileId: 'file-1',
      storageKey: 'users/user-1/chats/file-1-report.pdf',
      url: 'https://cdn.example/report.pdf',
      originalName: 'report.pdf',
      mimetype: 'application/pdf',
      size: 10,
    });

    expect(mocks.getFileByPath).toHaveBeenCalledWith('users/user-1/chats/file-1-report.pdf');
    expect(mocks.processFile).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      'report.pdf',
      'application/pdf',
      'file-1',
    );
    expect(mocks.upsert).toHaveBeenCalledWith(
      { db: true },
      {
        id: 'file-1',
        userId: 'user-1',
        storageKey: 'users/user-1/chats/file-1-report.pdf',
        originalName: 'report.pdf',
        mimetype: 'application/pdf',
        size: 10,
        url: 'https://cdn.example/report.pdf',
        content: 'Summary',
        textContent: 'Extracted text',
        metadata: { pages: 1 },
      },
    );
  });
});
