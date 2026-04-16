import {
  createNotesMutationSuccessHandler,
  DEFAULT_NOTES_FEED_LIMIT,
  useApiClient,
  useRpcMutation,
  useRpcQuery,
} from '@hominem/rpc/react';
import type {
  NoteFeedItem,
  NotesCreateInput,
  NotesCreateOutput,
  NotesDeleteOutput,
  NotesFeedInput,
  NotesFeedOutput,
  NotesGetOutput,
  NotesListInput,
  NotesSearchOutput,
  NotesUpdateInput,
  NotesUpdateOutput,
} from '@hominem/rpc/types/notes.types';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { notesQueryKeys } from '~/lib/query-keys';
import { requestNotesRowExit } from '~/routes/notes/notes-surface-events';

interface UseNotesListOptions {
  enabled?: boolean;
}

interface NotesFeedPage {
  notes: NoteFeedItem[];
  nextCursor: string | null;
}

interface NotesFeedData {
  pages: NotesFeedPage[];
  pageParams: Array<string | null>;
}

interface CreateNoteContext {
  optimisticId: string;
  previousFeed: NotesFeedData | undefined;
}

export function flattenNoteFeedPages(data: NotesFeedData | undefined): NoteFeedItem[] {
  return (data?.pages.flatMap((page) => page.notes) ?? []).slice().reverse();
}

function buildOptimisticFeedNote(input: NotesCreateInput): NoteFeedItem {
  const now = new Date().toISOString();
  const trimmed = input.content.trim();

  return {
    id: `optimistic-note-${Date.now().toString()}`,
    title: input.title?.trim() || null,
    contentPreview: trimmed.replace(/\s+/g, ' ').trim().slice(0, 240),
    createdAt: now,
    authorId: 'optimistic-user',
    metadata: {
      hasAttachments: Boolean(input.fileIds?.length),
    },
  };
}

function prependOptimisticFeedNote(
  current: NotesFeedData | undefined,
  optimisticNote: NoteFeedItem,
): NotesFeedData {
  if (!current || current.pages.length === 0) {
    return {
      pages: [{ notes: [optimisticNote], nextCursor: null }],
      pageParams: [null],
    };
  }

  const [firstPage, ...restPages] = current.pages;
  if (!firstPage) {
    return {
      pages: [{ notes: [optimisticNote], nextCursor: null }],
      pageParams: [null],
    };
  }

  return {
    ...current,
    pages: [{ ...firstPage, notes: [...firstPage.notes, optimisticNote] }, ...restPages],
  };
}

function removeFeedNote(
  current: NotesFeedData | undefined,
  noteId: string,
): NotesFeedData | undefined {
  if (!current) {
    return current;
  }

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      notes: page.notes.filter((note) => note.id !== noteId),
    })),
  };
}

export function useNotesList(options: NotesListInput = {}, queryOptions: UseNotesListOptions = {}) {
  return useRpcQuery(
    async ({ notes }) => {
      const data = await notes.list(options);
      return Array.isArray(data.notes) ? data.notes : [];
    },
    {
      enabled: queryOptions.enabled ?? true,
      queryKey: notesQueryKeys.list(options),
      staleTime: 1000 * 60 * 1, // 1 minute
    },
  );
}

export function useNotesFeed(
  options: Omit<NotesFeedInput, 'cursor'> = {},
  queryOptions: UseNotesListOptions = {},
) {
  const client = useApiClient();
  const limit = options.limit ?? DEFAULT_NOTES_FEED_LIMIT;

  return useInfiniteQuery<NotesFeedOutput, Error, NotesFeedData, readonly unknown[], string | null>(
    {
      queryKey: notesQueryKeys.feed({ limit }),
      initialPageParam: null,
      queryFn: async ({ pageParam }) => {
        return client.notes.feed({
          limit,
          ...(pageParam ? { cursor: pageParam } : {}),
        });
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: queryOptions.enabled ?? true,
      staleTime: 1000 * 30,
    },
  );
}

export function useNote(id: string) {
  return useRpcQuery<NotesGetOutput>(({ notes }) => notes.get({ id }), {
    queryKey: notesQueryKeys.detail(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useNoteSearch(query: string, enabled = true) {
  return useInfiniteQuery<NotesSearchOutput, Error, NotesSearchOutput, readonly unknown[], string | null>({
    queryKey: notesQueryKeys.search(query),
    initialPageParam: null,
    enabled: enabled && query.trim().length > 0,
    staleTime: 1000 * 30,
    queryFn: async ({ pageParam }) => {
      const client = useApiClient();
      return client.notes.search({
        query,
        limit: 8,
        ...(pageParam ? { cursor: pageParam } : {}),
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    select: (data) => {
      const notes = data.pages.flatMap((page) => page.notes);
      return {
        pages: data.pages,
        pageParams: data.pageParams,
        notes,
        nextCursor: data.pages.at(-1)?.nextCursor ?? null,
      } as NotesSearchOutput & { pages: typeof data.pages; pageParams: typeof data.pageParams };
    },
  });
}

export function useCreateNote() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<NotesCreateOutput, Error, NotesCreateInput, CreateNoteContext>({
    mutationFn: (variables) => client.notes.create(variables),
    onMutate: async (variables) => {
      const optimisticNote = buildOptimisticFeedNote(variables);
      const feedQueryKey = notesQueryKeys.feed({ limit: DEFAULT_NOTES_FEED_LIMIT });

      await queryClient.cancelQueries({ queryKey: feedQueryKey });
      const previousFeed = queryClient.getQueryData<NotesFeedData>(feedQueryKey);

      queryClient.setQueryData<NotesFeedData>(feedQueryKey, (current) =>
        prependOptimisticFeedNote(current, optimisticNote),
      );

      return {
        optimisticId: optimisticNote.id,
        previousFeed,
      };
    },
    onError: (_error, _variables, context) => {
      const feedQueryKey = notesQueryKeys.feed({ limit: DEFAULT_NOTES_FEED_LIMIT });
      queryClient.setQueryData(feedQueryKey, context?.previousFeed);
    },
    onSuccess: async (createdNote, _variables, context) => {
      if (context?.optimisticId) {
        await requestNotesRowExit(context.optimisticId);
      }
      queryClient.setQueryData(notesQueryKeys.detail(createdNote.id), createdNote);
      queryClient.invalidateQueries({ queryKey: notesQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: notesQueryKeys.feeds() });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useRpcMutation<NotesUpdateOutput, { id: string } & NotesUpdateInput>(
    ({ notes }, variables) => notes.update(variables),
    {
      onSuccess: (data) => {
        createNotesMutationSuccessHandler(queryClient, data.id);
      },
    },
  );
}

export function useDeleteNote() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation<
    NotesDeleteOutput,
    Error,
    { id: string },
    { previousFeed: NotesFeedData | undefined }
  >({
    mutationFn: (variables) => client.notes.delete(variables),
    onMutate: async (variables) => {
      const feedQueryKey = notesQueryKeys.feed({ limit: DEFAULT_NOTES_FEED_LIMIT });
      await queryClient.cancelQueries({ queryKey: feedQueryKey });
      const previousFeed = queryClient.getQueryData<NotesFeedData>(feedQueryKey);

      await requestNotesRowExit(variables.id);
      queryClient.setQueryData<NotesFeedData>(feedQueryKey, (current) =>
        removeFeedNote(current, variables.id),
      );

      return { previousFeed };
    },
    onError: (_error, _variables, context) => {
      const feedQueryKey = notesQueryKeys.feed({ limit: DEFAULT_NOTES_FEED_LIMIT });
      queryClient.setQueryData(feedQueryKey, context?.previousFeed);
    },
    onSuccess: async (_, variables) => {
      await createNotesMutationSuccessHandler(queryClient, variables.id);
    },
  });
}
