import { useApiClient } from '@hominem/rpc/react';
import type {
  NoteFeedItem,
  NoteFeedPage,
  NotesCreateInput,
  NotesFeedInput,
  NotesListInput,
  NotesSearchOutput,
  NotesUpdateInput,
} from '@hominem/rpc/types/notes.types';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { inboxQueryKeys, notesQueryKeys } from '~/lib/query-keys';

interface UseNotesListOptions {
  enabled?: boolean;
}

export interface NotesFeedPage {
  notes: NoteFeedItem[];
  nextCursor: string | null;
}

export interface NotesFeedData {
  pages: NotesFeedPage[];
  pageParams: Array<string | null>;
}

export function flattenNoteFeedPages(data: NotesFeedData | undefined): NoteFeedItem[] {
  return (data?.pages.flatMap((page) => page.notes) ?? []).slice().reverse();
}

export function useNotesList(options: NotesListInput = {}, queryOptions: UseNotesListOptions = {}) {
  const client = useApiClient();

  return useQuery({
    queryKey: notesQueryKeys.list(options),
    enabled: queryOptions.enabled ?? true,
    staleTime: 1000 * 60 * 1,
    queryFn: async () => {
      const query: {
        query?: string;
        since?: string;
        sortBy?: 'createdAt' | 'updatedAt' | 'title';
        sortOrder?: 'asc' | 'desc';
        limit?: string;
        offset?: string;
      } = {};
      if (options.query) query.query = options.query;
      if (options.since) query.since = options.since;
      if (options.sortBy) query.sortBy = options.sortBy;
      if (options.sortOrder) query.sortOrder = options.sortOrder;
      if (options.limit != null) query.limit = String(options.limit);
      if (options.offset != null) query.offset = String(options.offset);
      const res = await client.api.notes.$get({ query });
      const data = await res.json();
      return Array.isArray(data.notes) ? data.notes : [];
    },
  });
}

interface UseNotesFeedOptions extends UseNotesListOptions {
  initialData?: NotesFeedData;
}

export function useNotesFeed(
  options: Omit<NotesFeedInput, 'cursor'> = {},
  queryOptions: UseNotesFeedOptions = {},
) {
  const client = useApiClient();
  const limit = options.limit ?? 20;

  return useInfiniteQuery<NoteFeedPage, Error, NotesFeedData, readonly unknown[], string | null>(
    {
      queryKey: notesQueryKeys.feed({ limit }),
      initialPageParam: null,
      queryFn: async ({ pageParam }) => {
        const query: { limit: string; cursor?: string } = { limit: String(limit) };
        if (pageParam) query.cursor = pageParam;
        const res = await client.api.notes.feed.$get({ query });
        return res.json();
      },
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      enabled: queryOptions.enabled ?? true,
      staleTime: 1000 * 30,
      ...(queryOptions.initialData ? { initialData: queryOptions.initialData } : {}),
    },
  );
}

export function useNote(id: string) {
  const client = useApiClient();

  return useQuery({
    queryKey: notesQueryKeys.detail(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
    queryFn: () => client.api.notes[':id'].$get({ param: { id } }).then((r) => r.json()),
  });
}

export function useNoteSearch(query: string, enabled = true) {
  const client = useApiClient();

  return useInfiniteQuery<
    NotesSearchOutput,
    Error,
    NotesSearchOutput,
    readonly unknown[],
    string | null
  >({
    queryKey: notesQueryKeys.search(query),
    initialPageParam: null,
    enabled: enabled && query.trim().length > 0,
    staleTime: 1000 * 30,
    queryFn: async ({ pageParam }) => {
      const q: { query: string; limit?: string; cursor?: string } = { query, limit: '8' };
      if (pageParam) q.cursor = pageParam;
      const res = await client.api.notes.search.$get({ query: q });
      return res.json();
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

  return useMutation({
    mutationFn: async (variables: NotesCreateInput) => {
      const res = await client.api.notes.$post({ json: variables as never });
      return res.json();
    },
    onSuccess: (createdNote) => {
      queryClient.setQueryData(notesQueryKeys.detail(createdNote.id), createdNote);
      queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
    },
  });
}

export function useUpdateNote() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string } & NotesUpdateInput) => {
      const { id, ...fields } = variables;
      const res = await client.api.notes[':id'].$patch({
        param: { id },
        json: fields as never,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(notesQueryKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
    },
  });
}

export function useDeleteNote() {
  const client = useApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { id: string }) => {
      const res = await client.api.notes[':id'].$delete({ param: { id: variables.id } });
      return res.json();
    },
    onSuccess: async (_, variables) => {
      queryClient.removeQueries({ queryKey: notesQueryKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: inboxQueryKeys.pages() });
    },
  });
}
