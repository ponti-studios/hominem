import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { flattenNoteFeedPages, useCreateNote } from './use-notes';

const mocks = vi.hoisted(() => ({
  createNote: vi.fn(),
}));

vi.mock('@hominem/rpc/react', async () => {
  const actual = await vi.importActual<typeof import('@hominem/rpc/react')>('@hominem/rpc/react');
  return {
    ...actual,
    useApiClient: () => ({
      notes: {
        create: mocks.createNote,
      },
    }),
  };
});

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

const createdNote = {
  id: 'note-123',
  userId: 'user-1',
  type: 'note' as const,
  status: 'draft' as const,
  title: 'Draft note',
  content: 'Draft note\nBody copy',
  excerpt: 'Draft note Body copy',
  tags: [],
  mentions: [],
  analysis: null,
  publishingMetadata: null,
  parentNoteId: null,
  files: [],
  versionNumber: 1,
  isLatestVersion: true,
  publishedAt: null,
  scheduledFor: null,
  createdAt: '2026-04-09T12:00:00.000Z',
  updatedAt: '2026-04-09T12:00:00.000Z',
};

describe('flattenNoteFeedPages', () => {
  it('returns notes in bottom-anchored display order', () => {
    const notes = flattenNoteFeedPages({
      pages: [
        {
          notes: [
            {
              id: 'newest',
              title: 'Newest',
              contentPreview: 'Newest body',
              createdAt: '2026-04-05T12:02:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
            {
              id: 'middle',
              title: 'Middle',
              contentPreview: 'Middle body',
              createdAt: '2026-04-05T12:01:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
          ],
          nextCursor: 'cursor-1',
        },
        {
          notes: [
            {
              id: 'oldest',
              title: 'Oldest',
              contentPreview: 'Oldest body',
              createdAt: '2026-04-05T12:00:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null, 'cursor-1'],
    });

    expect(notes.map((note) => note.id)).toEqual(['oldest', 'middle', 'newest']);
  });
});

describe('useCreateNote', () => {
  it('seeds the canonical note detail cache on success', async () => {
    mocks.createNote.mockResolvedValue(createdNote);
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useCreateNote(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({
        title: 'Draft note',
        content: 'Draft note\nBody copy',
      });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData(['notes', 'detail', createdNote.id])).toEqual(createdNote);
    });
  });

  it('rolls back optimistic feed state immediately when creation fails', async () => {
    mocks.createNote.mockRejectedValueOnce(new Error('create failed'));
    const queryClient = new QueryClient();
    queryClient.setQueryData(['notes', 'feed', { limit: 20 }], {
      pages: [
        {
          notes: [
            {
              id: 'existing-note',
              title: 'Existing note',
              contentPreview: 'Existing body',
              createdAt: '2026-04-09T11:00:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null],
    });

    const { result } = renderHook(() => useCreateNote(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          title: 'Draft note',
          content: 'Draft note\nBody copy',
        });
      }),
    ).rejects.toThrow('create failed');

    expect(queryClient.getQueryData(['notes', 'feed', { limit: 20 }])).toEqual({
      pages: [
        {
          notes: [
            {
              id: 'existing-note',
              title: 'Existing note',
              contentPreview: 'Existing body',
              createdAt: '2026-04-09T11:00:00.000Z',
              authorId: 'user-1',
              metadata: { hasAttachments: false },
            },
          ],
          nextCursor: null,
        },
      ],
      pageParams: [null],
    });
  });
});
