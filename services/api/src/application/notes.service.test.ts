import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NoteService } from './notes.service';

const mocks = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockListFeed: vi.fn(),
  mockSearch: vi.fn(),
  mockLoad: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockSyncFiles: vi.fn(),
  mockDelete: vi.fn(),
  mockGetOwnedOrThrow: vi.fn(),
  mockRunInTransaction: vi.fn(),
}));

vi.mock('@hominem/db', () => ({
  getDb: vi.fn(() => ({ db: true })),
  runInTransaction: vi.fn((handler) => mocks.mockRunInTransaction(handler)),
  NoteRepository: {
    list: mocks.mockList,
    listFeed: mocks.mockListFeed,
    search: mocks.mockSearch,
    load: mocks.mockLoad,
    create: mocks.mockCreate,
    update: mocks.mockUpdate,
    syncFiles: mocks.mockSyncFiles,
    delete: mocks.mockDelete,
    getOwnedOrThrow: mocks.mockGetOwnedOrThrow,
  },
}));

describe('NoteService', () => {
  const service = new NoteService();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates read operations to the repository', async () => {
    mocks.mockList.mockResolvedValueOnce([{ id: 'note-1' }]);
    mocks.mockListFeed.mockResolvedValueOnce({ notes: [{ id: 'feed-1' }], nextCursor: 'cursor-1' });
    mocks.mockSearch.mockResolvedValueOnce([{ id: 'note-2', title: 'Match', excerpt: 'Match' }]);
    mocks.mockLoad.mockResolvedValueOnce({ id: 'note-3' });

    await expect(service.listNotes('user-1', { limit: 10 })).resolves.toEqual([{ id: 'note-1' }]);
    await expect(service.listNoteFeed('user-1', { limit: 20 })).resolves.toEqual({
      notes: [{ id: 'feed-1' }],
      nextCursor: 'cursor-1',
    });
    await expect(service.searchNotes('user-1', 'match', 5)).resolves.toEqual([
      { id: 'note-2', title: 'Match', excerpt: 'Match' },
    ]);
    await expect(service.getNote('note-3', 'user-1')).resolves.toEqual({ id: 'note-3' });

    expect(mocks.mockList).toHaveBeenCalledWith(expect.any(Object), {
      userId: 'user-1',
      limit: 10,
    });
    expect(mocks.mockListFeed).toHaveBeenCalledWith(expect.any(Object), {
      userId: 'user-1',
      limit: 20,
    });
    expect(mocks.mockSearch).toHaveBeenCalledWith(expect.any(Object), {
      userId: 'user-1',
      query: 'match',
      limit: 5,
    });
    expect(mocks.mockLoad).toHaveBeenCalledWith(expect.any(Object), 'note-3', 'user-1');
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

  it('updates notes inside a transaction', async () => {
    mocks.mockGetOwnedOrThrow.mockResolvedValueOnce({
      content: 'Current body',
      excerpt: 'Current body',
      title: 'Current title',
    });
    mocks.mockLoad.mockResolvedValueOnce({ id: 'note-1', title: 'Updated title' });
    mocks.mockRunInTransaction.mockImplementationOnce(async (handler) => handler({ trx: true }));

    await expect(
      service.updateNote('note-1', 'user-1', {
        content: 'Updated body',
        fileIds: ['file-2'],
      }),
    ).resolves.toEqual({ id: 'note-1', title: 'Updated title' });

    expect(mocks.mockUpdate).toHaveBeenCalledWith({ trx: true }, 'note-1', 'user-1', {
      title: 'Updated body',
      content: 'Updated body',
      excerpt: 'Current body',
    });
    expect(mocks.mockSyncFiles).toHaveBeenCalledWith({ trx: true }, 'note-1', 'user-1', ['file-2']);
  });

  it('deletes notes by loading then removing them', async () => {
    mocks.mockLoad.mockResolvedValueOnce({ id: 'note-1' });

    await expect(service.deleteNote('note-1', 'user-1')).resolves.toEqual({ id: 'note-1' });

    expect(mocks.mockDelete).toHaveBeenCalledWith(expect.any(Object), 'note-1', 'user-1');
  });
});
