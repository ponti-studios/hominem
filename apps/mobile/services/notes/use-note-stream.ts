import { useApiClient } from '@hakumi/rpc/react';
import type { Note, NoteFeedItem, NotesFeedOutput } from '@hakumi/rpc/types';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';

import { noteKeys } from './query-keys';

const DEFAULT_NOTES_FEED_LIMIT = 20;

function toNoteStub(item: NoteFeedItem): Note {
  return {
    id: item.id,
    userId: item.authorId,
    type: 'note',
    status: 'draft',
    title: item.title,
    content: item.contentPreview,
    excerpt: item.contentPreview,
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
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
  };
}

export function flattenNoteFeedPages(
  data: { pages: NotesFeedOutput[] } | undefined,
): NoteFeedItem[] {
  return (data?.pages.flatMap((page) => page.notes) ?? []).slice().reverse();
}

export function useNoteFeed({ enabled = true, limit = DEFAULT_NOTES_FEED_LIMIT } = {}) {
  const client = useApiClient();

  return useInfiniteQuery<
    NotesFeedOutput,
    Error,
    { pages: NotesFeedOutput[]; pageParams: Array<string | null> },
    readonly unknown[],
    string | null
  >({
    queryKey: noteKeys.feed({ limit }),
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      client.notes.feed({
        limit,
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    initialData: {
      pages: [],
      pageParams: [],
    },
  });
}

export function useNoteStream({ enabled = true }: { enabled?: boolean } = {}) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useQuery<Note[]>({
    queryKey: noteKeys.all,
    staleTime: 0,
    queryFn: async () => {
      const response = await client.notes.list({
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        limit: 100,
      });
      return response.notes;
    },
    initialData: () => {
      const feedData = queryClient.getQueryData<{ pages: NotesFeedOutput[] }>(
        noteKeys.feed({ limit: DEFAULT_NOTES_FEED_LIMIT }),
      );
      const feedNotes = flattenNoteFeedPages(feedData);
      return feedNotes.map(toNoteStub);
    },
    enabled,
  });
}
