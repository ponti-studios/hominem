import { SectionIntro, StatePanel } from '@hominem/ui';
import { Composer } from '@hominem/ui/composer';
import type { ComposerActions } from '@hominem/ui/composer/composer-provider';
import { ComposerProvider, ComposerStore } from '@hominem/ui/composer/composer-provider';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { data, redirect, useNavigate } from 'react-router';

import { useCreateChat } from '~/hooks/use-chats';
import { useComposerMode } from '~/hooks/use-composer-mode';
import {
  flattenNoteFeedPages,
  type NotesFeedData,
  useCreateNote,
  useNotesFeed,
  useUpdateNote,
} from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { useFileUpload } from '~/lib/hooks/use-file-upload';
import { getServerSession } from '~/lib/auth.server';
import { serverEnv } from '~/lib/env.server';


import { NoteStreamRow } from './components/note-stream-row';
import {
  completeNotesRowExit,
  NOTES_ROW_EXIT_REQUEST_EVENT,
  type NotesRowExitRequestDetail,
} from './notes-surface-events';
import { animateNotesRowEnter, animateNotesRowExit } from './notes-surface-motion';

const FEED_ESTIMATED_ROW_HEIGHT = 128;
const FEED_OVERSCAN_COUNT = 6;
const FEED_NEAR_BOTTOM_THRESHOLD = 96;
const FEED_LOAD_MORE_THRESHOLD_INDEX = 2;

export async function loader({ request }: { request: Request }) {
  const { user } = await getServerSession(request);
  if (!user) {
    throw redirect('/auth');
  }

  const cookie = request.headers.get('cookie');
  const headers = cookie ? { cookie } : undefined;
  const response = await fetch(
    new URL('/api/notes/feed?limit=20', serverEnv.VITE_PUBLIC_API_URL).toString(),
    { headers },
  );
  const feed: NotesFeedData = response.ok
    ? ((await response.json()) as NotesFeedData)
    : { pages: [], pageParams: [] };

  return data({ feed });
}

export default function NotesPage({ loaderData }: { loaderData: { feed: NotesFeedData } }) {
  const feedQuery = useNotesFeed({ limit: 20 }, { initialData: loaderData.feed });
  const notes = useMemo(() => flattenNoteFeedPages(feedQuery.data), [feedQuery.data]);
  const composerStore = useMemo(() => new ComposerStore(), []);
  const actionsRef = useRef<ComposerActions>({} as ComposerActions);

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const createChat = useCreateChat();
  const { uploadFiles } = useFileUpload();
  const transcribeMutation = useTranscribe();
  const { mode, noteId, chatId } = useComposerMode();
  const navigate = useNavigate();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrollObserverRef = useRef<MutationObserver | null>(null);
  const animatedRowIdsRef = useRef(new Set<string>());
  const noteRowListenersRef = useRef(new Map<string, EventListener>());
  const lastScrollHeightRef = useRef<number | null>(null);
  const previousNoteCountRef = useRef(0);
  const isAnchoringOlderNotesRef = useRef(false);
  const hasScrolledInitialLoadRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: notes.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => FEED_ESTIMATED_ROW_HEIGHT,
    overscan: FEED_OVERSCAN_COUNT,
  });

  const virtualItems = virtualizer.getVirtualItems();

  const updateNearBottom = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop;

    setIsNearBottom(distanceFromBottom <= FEED_NEAR_BOTTOM_THRESHOLD);
  }, []);

  const scrollToBottom = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    scrollElement.scrollTop = Math.max(scrollElement.scrollHeight - scrollElement.clientHeight, 0);
  }, []);

  const handleNotesCountChange = useCallback(
    (nextCount: number) => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) {
        return;
      }

      const previousCount = previousNoteCountRef.current;
      const wasInitialHydration = previousCount === 0 && nextCount > 0;
      const didPrependOlderNotes =
        isAnchoringOlderNotesRef.current && lastScrollHeightRef.current !== null;
      const didAppendNewerNote = nextCount > previousCount && !isAnchoringOlderNotesRef.current;

      if (wasInitialHydration) {
        hasScrolledInitialLoadRef.current = true;
        scrollToBottom();
      } else if (didPrependOlderNotes) {
        const previousScrollHeight = lastScrollHeightRef.current;
        lastScrollHeightRef.current = null;
        isAnchoringOlderNotesRef.current = false;

        if (previousScrollHeight === null) {
          previousNoteCountRef.current = nextCount;
          updateNearBottom();
          return;
        }

        const nextScrollHeight = scrollElement.scrollHeight;
        scrollElement.scrollTop += nextScrollHeight - previousScrollHeight;
      } else if (didAppendNewerNote && isNearBottom) {
        requestAnimationFrame(scrollToBottom);
      }

      previousNoteCountRef.current = nextCount;
      updateNearBottom();
    },
    [isNearBottom, scrollToBottom, updateNearBottom],
  );

  const maybeLoadOlderNotes = useCallback(() => {
    const [firstItem] = virtualItems;
    if (
      !firstItem ||
      firstItem.index > FEED_LOAD_MORE_THRESHOLD_INDEX ||
      !feedQuery.hasNextPage ||
      feedQuery.isFetchingNextPage
    ) {
      return;
    }

    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }

    lastScrollHeightRef.current = scrollElement.scrollHeight;
    isAnchoringOlderNotesRef.current = true;
    void feedQuery.fetchNextPage();
  }, [feedQuery, virtualItems]);

  const setScrollElement = useCallback(
    (element: HTMLDivElement | null) => {
      scrollObserverRef.current?.disconnect();
      scrollRef.current = element;

      if (!element) {
        return;
      }

      const observer = new MutationObserver(() => {
        handleNotesCountChange(notes.length);
        maybeLoadOlderNotes();
      });

      scrollObserverRef.current = observer;
      observer.observe(element, { childList: true, subtree: true });

      if (!hasScrolledInitialLoadRef.current && notes.length > 0) {
        handleNotesCountChange(notes.length);
      }
    },
    [handleNotesCountChange, maybeLoadOlderNotes, notes.length],
  );

  const handleCreated = useCallback(() => {
    if (!isNearBottom) {
      return;
    }

    requestAnimationFrame(scrollToBottom);
  }, [isNearBottom, scrollToBottom]);

  useEffect(
    () => () => {
      scrollObserverRef.current?.disconnect();
      for (const [noteId, handler] of noteRowListenersRef.current) {
        window.removeEventListener(NOTES_ROW_EXIT_REQUEST_EVENT, handler);
        noteRowListenersRef.current.delete(noteId);
      }
    },
    [],
  );

  actionsRef.current = {
    createNote: async (input) => {
      const result = await createNote.mutateAsync(input);
      handleCreated();
      navigate(`/notes/${result.id}`);
      return result;
    },
    updateNote: async (input) => updateNote.mutateAsync(input),
    sendMessage: async (_input) => {},
    createChat: async (input) => {
      const chat = await createChat.mutateAsync({ title: input.title });
      return { id: chat.id };
    },
    uploadFiles,
    navigate,
  };

  useEffect(() => {
    const saved = window.localStorage.getItem('hominem:web:notes:new-draft');
    if (saved) {
      composerStore.dispatch({ type: 'SET_DRAFT', text: saved });
      window.localStorage.removeItem('hominem:web:notes:new-draft');
    }
  }, [composerStore]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 md:px-6 lg:px-8 pt-6 pb-2">
        <SectionIntro
          title="Notes"
          description="The stream stays anchored. New notes rise in place and stay easy to scan."
          className="mb-5"
        />
      </div>
      <main className="flex min-h-0 w-full flex-1 flex-col border-t border-border-subtle">
        <div
          ref={setScrollElement}
          onScroll={updateNearBottom}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden"
        >
          {feedQuery.isLoading ? (
            <div className="mx-auto w-full max-w-4xl px-4 py-5 text-body-4 text-text-secondary md:px-6 lg:px-8">
              Loading notes...
            </div>
          ) : null}

          {!feedQuery.isLoading && notes.length === 0 ? (
            <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 lg:px-8">
              <StatePanel
                title="Start with a thought."
                description="New notes and conversations will appear here together."
              />
            </div>
          ) : null}

          {notes.length > 0 ? (
            <div className="mx-auto w-full max-w-4xl px-4 md:px-6 lg:px-8">
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualItems.map((virtualItem) => {
                  const note = notes[virtualItem.index];
                  if (!note) {
                    return null;
                  }

                  const setRowElement = (element: HTMLDivElement | null) => {
                    const existingHandler = noteRowListenersRef.current.get(note.id);
                    if (existingHandler) {
                      window.removeEventListener(NOTES_ROW_EXIT_REQUEST_EVENT, existingHandler);
                      noteRowListenersRef.current.delete(note.id);
                    }

                    if (!element) {
                      return;
                    }

                    const handleExitRequest = (event: Event) => {
                      const customEvent = event as CustomEvent<NotesRowExitRequestDetail>;
                      if (customEvent.detail.noteId !== note.id) {
                        return;
                      }

                      animateNotesRowExit(element, () => completeNotesRowExit(note.id));
                    };

                    noteRowListenersRef.current.set(note.id, handleExitRequest);
                    window.addEventListener(NOTES_ROW_EXIT_REQUEST_EVENT, handleExitRequest);
                    virtualizer.measureElement(element);
                    if (animatedRowIdsRef.current.has(note.id)) {
                      return;
                    }

                    animatedRowIdsRef.current.add(note.id);
                    animateNotesRowEnter(element);
                  };

                  return (
                    <div
                      key={virtualItem.key}
                      ref={setRowElement}
                      data-index={virtualItem.index}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                    >
                      <NoteStreamRow note={note} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </main>
      <ComposerProvider store={composerStore} actionsRef={actionsRef}>
        <Composer
          mode={mode}
          noteId={noteId}
          chatId={chatId}
          navigate={navigate}
          transcribeMutation={transcribeMutation}
          inlineVoiceEnabled={true}
        />
      </ComposerProvider>
    </div>
  );
}
