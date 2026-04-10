import type { Note } from '@hominem/rpc/types/notes.types';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NoteEditor } from './note-editor';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  deleteImplementation: vi.fn<() => Promise<unknown>>(),
  updateMutateAsync: vi.fn(),
  transcribeMutateAsync: vi.fn(),
  uploadFiles: vi.fn(),
  clearAll: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useNavigate: () => mocks.navigate,
  };
});

vi.mock('~/hooks/use-notes', () => ({
  useUpdateNote: () => ({
    mutateAsync: mocks.updateMutateAsync,
  }),
  useDeleteNote: () => {
    const [isPending, setIsPending] = useState(false);
    const [isError, setIsError] = useState(false);

    return {
      isPending,
      isError,
      mutateAsync: async () => {
        setIsError(false);
        setIsPending(true);

        try {
          return await mocks.deleteImplementation();
        } catch (error) {
          setIsError(true);
          throw error;
        } finally {
          setIsPending(false);
        }
      },
    };
  },
}));

vi.mock('~/hooks/use-transcribe', () => ({
  useTranscribe: () => ({
    mutateAsync: mocks.transcribeMutateAsync,
  }),
}));

vi.mock('~/lib/hooks/use-file-upload', () => ({
  useFileUpload: () => ({
    uploadFiles: mocks.uploadFiles,
    clearAll: mocks.clearAll,
    uploadState: {
      errors: [],
    },
  }),
}));

const note: Note = {
  id: 'note-1',
  userId: 'user-1',
  type: 'note',
  status: 'draft',
  title: 'Test note',
  content: 'Body',
  excerpt: 'Body',
  tags: [],
  mentions: null,
  analysis: null,
  publishingMetadata: null,
  parentNoteId: null,
  files: [],
  versionNumber: 1,
  isLatestVersion: true,
  publishedAt: null,
  scheduledFor: null,
  createdAt: '2026-04-05T12:00:00.000Z',
  updatedAt: '2026-04-05T12:00:00.000Z',
};

describe('NoteEditor delete flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows pending delete state in the confirmation action', async () => {
    let resolveDelete: (() => void) | undefined;
    mocks.deleteImplementation.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    render(
      <MemoryRouter>
        <NoteEditor note={note} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    await screen.findByText('Delete this note?');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    });

    resolveDelete?.();

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith('/notes');
    });
  });

  it('shows an inline error when delete fails', async () => {
    mocks.deleteImplementation.mockRejectedValueOnce(new Error('delete failed'));

    render(
      <MemoryRouter>
        <NoteEditor note={note} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete note' }));
    await screen.findByText('Delete this note?');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to delete note. Please try again.')).toBeInTheDocument();
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
