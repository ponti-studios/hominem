import { useApiClient } from '@hominem/rpc/react';
import type { Note, NoteFeedItem, NotesFeedOutput } from '@hominem/rpc/types';
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
    queryFn: async ({ pageParam }) => {
      const query: Record<string, string> = { limit: String(limit) };
      if (pageParam) query.cursor = pageParam;
      const res = await client.api.notes.feed.$get({ query });
      return res.json();
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled,
    initialData: {
      pages: [],
      pageParams: [],
    },
  });
}

const NOTE_STREAM_STALE_TIME_MS = 30_000;

export function useNoteStream({ enabled = true }: { enabled?: boolean } = {}) {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useQuery<Note[]>({
    queryKey: noteKeys.all,
    staleTime: NOTE_STREAM_STALE_TIME_MS,
    queryFn: async () => {
      const res = await client.api.notes.$get({
        query: { sortBy: 'updatedAt', sortOrder: 'desc', limit: '100' },
      });
      const response = await res.json();
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
