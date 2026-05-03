import type { InboxOutput } from '@hominem/rpc/react';
import { SectionIntro, StatePanel } from '@hominem/ui';
import { Composer } from '@hominem/ui/composer';
import type { ComposerActions } from '@hominem/ui/composer/composer-provider';
import { ComposerProvider, ComposerStore } from '@hominem/ui/composer/composer-provider';
import { InboxStreamRow } from '@hominem/ui/inbox';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { data, redirect, useNavigate } from 'react-router';

import { useCreateChat } from '~/hooks/use-chats';
import { useComposerMode } from '~/hooks/use-composer-mode';
import { useInbox } from '~/hooks/use-inbox';
import { useCreateNote, useUpdateNote } from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { getServerSession } from '~/lib/auth.server';
import { serverEnv } from '~/lib/env.server';
import { useFileUpload } from '~/lib/hooks/use-file-upload';

const FEED_ESTIMATED_ROW_HEIGHT = 128;
const FEED_OVERSCAN_COUNT = 6;
const FEED_NEAR_BOTTOM_THRESHOLD = 96;

export async function loader({ request }: { request: Request }) {
  const { user } = await getServerSession(request);
  if (!user) {
    throw redirect('/auth');
  }

  const cookie = request.headers.get('cookie');
  const headers = cookie ? { cookie } : undefined;
  const response = await fetch(
    new URL('/api/inbox?limit=20', serverEnv.VITE_PUBLIC_API_URL).toString(),
    { headers },
  );
  const inbox: InboxOutput = response.ok ? ((await response.json()) as InboxOutput) : { items: [] };

  return data({ inbox });
}

export default function NotesPage({ loaderData }: { loaderData: { inbox: InboxOutput } }) {
  const inboxQuery = useInbox(20);
  const items = useMemo(
    () => inboxQuery.data?.items || loaderData.inbox.items,
    [inboxQuery.data, loaderData.inbox.items],
  );
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
  const lastScrollHeightRef = useRef<number | null>(null);
  const previousNoteCountRef = useRef(0);
  const isAnchoringOlderNotesRef = useRef(false);
  const hasScrolledInitialLoadRef = useRef(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const virtualizer = useVirtualizer<HTMLDivElement, Element>({
    count: items.length,
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

  const handleItemsCountChange = useCallback(
    (nextCount: number) => {
      const scrollElement = scrollRef.current;
      if (!scrollElement) {
        return;
      }

      const previousCount = previousNoteCountRef.current;
      const wasInitialHydration = previousCount === 0 && nextCount > 0;
      const didPrependOlderItems =
        isAnchoringOlderNotesRef.current && lastScrollHeightRef.current !== null;
      const didAppendNewerItem = nextCount > previousCount && !isAnchoringOlderNotesRef.current;

      if (wasInitialHydration) {
        hasScrolledInitialLoadRef.current = true;
        scrollToBottom();
      } else if (didPrependOlderItems) {
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
      } else if (didAppendNewerItem && isNearBottom) {
        requestAnimationFrame(scrollToBottom);
      }

      previousNoteCountRef.current = nextCount;
      updateNearBottom();
    },
    [isNearBottom, scrollToBottom, updateNearBottom],
  );

  const maybeLoadOlderItems = useCallback(() => {
    // Inbox API doesn't support pagination yet, so this is a no-op
    // In the future, this can be extended to support cursor-based pagination
  }, []);

  const setScrollElement = useCallback(
    (element: HTMLDivElement | null) => {
      scrollObserverRef.current?.disconnect();
      scrollRef.current = element;

      if (!element) {
        return;
      }

      const observer = new MutationObserver(() => {
        handleItemsCountChange(items.length);
        maybeLoadOlderItems();
      });

      scrollObserverRef.current = observer;
      observer.observe(element, { childList: true, subtree: true });

      if (!hasScrolledInitialLoadRef.current && items.length > 0) {
        handleItemsCountChange(items.length);
      }
    },
    [handleItemsCountChange, maybeLoadOlderItems, items.length],
  );

  useEffect(
    () => () => {
      scrollObserverRef.current?.disconnect();
    },
    [],
  );

  actionsRef.current = {
    createNote: async (input) => {
      const result = await createNote.mutateAsync(input);
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
          title="Inbox"
          description="All your notes and chats in one stream. Updated items float to the top."
        />
      </div>
      <main className="flex min-h-0 w-full flex-1 flex-col border-t border-border-subtle">
        <div
          ref={setScrollElement}
          onScroll={updateNearBottom}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden"
        >
          {inboxQuery.isLoading ? (
            <div className="mx-auto w-full max-w-4xl px-4 py-5 text-body-4 text-text-secondary md:px-6 lg:px-8">
              Loading inbox...
            </div>
          ) : null}

          {!inboxQuery.isLoading && items.length === 0 ? (
            <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 lg:px-8">
              <StatePanel
                title="Your inbox is empty."
                description="Create a note or start a chat to get started."
              />
            </div>
          ) : null}

          {items.length > 0 ? (
            <div className="mx-auto w-full max-w-4xl px-4 md:px-6 lg:px-8">
              <div
                className="relative w-full"
                style={{ height: `${virtualizer.getTotalSize()}px` }}
              >
                {virtualItems.map((virtualItem) => {
                  const item = items[virtualItem.index];
                  if (!item) {
                    return null;
                  }

                  const setRowElement = (element: HTMLDivElement | null) => {
                    if (!element) {
                      return;
                    }

                    virtualizer.measureElement(element);
                  };

                  return (
                    <div
                      key={virtualItem.key}
                      ref={setRowElement}
                      data-index={virtualItem.index}
                      className="absolute left-0 top-0 w-full"
                      style={{ transform: `translateY(${virtualItem.start}px)` }}
                    >
                      <InboxStreamRow item={item} />
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
