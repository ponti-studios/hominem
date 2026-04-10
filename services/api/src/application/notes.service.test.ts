import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NoteService } from './notes.service';

const mocks = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSyncFiles: vi.fn(),
  mockLoad: vi.fn(),
  mockGetOwnedOrThrow: vi.fn(),
  mockRunInTransaction: vi.fn(),
}));

vi.mock('@hominem/db', () => ({
  getDb: vi.fn(() => ({ db: true })),
  runInTransaction: vi.fn((handler) => mocks.mockRunInTransaction(handler)),
  NoteRepository: {
    create: mocks.mockCreate,
    update: mocks.mockUpdate,
    syncFiles: mocks.mockSyncFiles,
    load: mocks.mockLoad,
    getOwnedOrThrow: mocks.mockGetOwnedOrThrow,
  },
}));

describe('NoteService', () => {
  const service = new NoteService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates notes inside a transaction and syncs files', async () => {
    mocks.mockCreate.mockResolvedValueOnce({ id: 'note-1' });
    mocks.mockLoad.mockResolvedValueOnce({ id: 'note-1', title: 'Hello', content: 'Hello world' });
    mocks.mockRunInTransaction.mockImplementationOnce(async (handler) => handler({ trx: true }));

    await expect(
      service.createNote('user-1', {
        title: '  ',
        content: 'Hello world',
        fileIds: ['file-1'],
      }),
    ).resolves.toEqual({ id: 'note-1', title: 'Hello', content: 'Hello world' });

    expect(mocks.mockCreate).toHaveBeenCalledWith(
      { trx: true },
      {
        userId: 'user-1',
        title: null,
        content: 'Hello world',
        excerpt: 'Hello world',
      },
    );
    expect(mocks.mockSyncFiles).toHaveBeenCalledWith({ trx: true }, 'note-1', 'user-1', ['file-1']);
  });

  it('derives title from first content line when title is not provided', async () => {
    mocks.mockCreate.mockResolvedValueOnce({ id: 'note-2' });
    mocks.mockLoad.mockResolvedValueOnce({
      id: 'note-2',
      title: 'First Line',
      content: 'First Line\nMore content',
    });
    mocks.mockRunInTransaction.mockImplementationOnce(async (handler) => handler({ trx: true }));

    await service.createNote('user-1', { content: 'First Line\nMore content' });

    expect(mocks.mockCreate).toHaveBeenCalledWith(
      { trx: true },
      expect.objectContaining({ title: 'First Line' }),
    );
  });

  it('updates notes inside a transaction', async () => {
    mocks.mockGetOwnedOrThrow.mockResolvedValueOnce({
      content: 'Current body',
      excerpt: 'Current body',
      title: 'Current title',
    });
    mocks.mockLoad.mockResolvedValueOnce({ id: 'note-1', title: 'Updated body' });
    mocks.mockRunInTransaction.mockImplementationOnce(async (handler) => handler({ trx: true }));

    await expect(
      service.updateNote('note-1', 'user-1', {
        content: 'Updated body',
        fileIds: ['file-2'],
      }),
    ).resolves.toEqual({ id: 'note-1', title: 'Updated body' });

    expect(mocks.mockUpdate).toHaveBeenCalledWith({ trx: true }, 'note-1', 'user-1', {
      title: 'Updated body',
      content: 'Updated body',
      excerpt: 'Current body',
    });
    expect(mocks.mockSyncFiles).toHaveBeenCalledWith({ trx: true }, 'note-1', 'user-1', ['file-2']);
  });

  it('re-derives title from new content when title not provided in update', async () => {
    mocks.mockGetOwnedOrThrow.mockResolvedValueOnce({
      content: 'Old content',
      excerpt: null,
      title: 'My Title',
    });
    mocks.mockLoad.mockResolvedValueOnce({ id: 'note-1', title: 'New content' });
    mocks.mockRunInTransaction.mockImplementationOnce(async (handler) => handler({ trx: true }));

    await service.updateNote('note-1', 'user-1', { content: 'New content' });

    expect(mocks.mockUpdate).toHaveBeenCalledWith({ trx: true }, 'note-1', 'user-1', {
      title: 'New content',
      content: 'New content',
      excerpt: null,
    });
  });
});
