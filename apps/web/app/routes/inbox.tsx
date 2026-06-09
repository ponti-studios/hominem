import type { InboxOutput } from '@hominem/rpc/react';
import { EmptyState } from '@hominem/ui';
import { Composer } from '@hominem/ui/composer';
import type { ComposerActions } from '@hominem/ui/composer/composer-provider';
import { ComposerStore } from '@hominem/ui/composer/composer-provider';
import { InboxStreamRow } from '@hominem/ui/inbox';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { data, useNavigate } from 'react-router';

import { useTextEnhance } from '~/hooks/ai';
import { useCreateChat } from '~/hooks/use-chats';
import { useComposerMode } from '~/hooks/use-composer-mode';
import { useInbox } from '~/hooks/use-inbox';
import { useCreateNote } from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { createServerApiClient } from '~/lib/api.server';
import { useFileUpload } from '~/lib/hooks/use-file-upload';

import { Route } from './+types/inbox';

const FEED_ESTIMATED_ROW_HEIGHT = 128;
const FEED_OVERSCAN_COUNT = 6;
const FEED_NEAR_BOTTOM_THRESHOLD = 96;
const NOTES_NEW_DRAFT_STORAGE_KEY = 'web:notes:new-draft';

export async function loader({ request }: Route.LoaderArgs) {
  try {
    const client = createServerApiClient(request);
    const inbox = await client.api.inbox.$get({ query: { limit: '20' } }).then((res) => res.json());
    return data({ inbox });
  } catch {
    return data({ inbox: { items: [], nextCursor: null } });
  }
}

export default function NotesPage({ loaderData }: { loaderData: { inbox: InboxOutput } }) {
  const inboxQuery = useInbox(20, { initialData: loaderData.inbox });
  const items = useMemo(
    () => inboxQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [inboxQuery.data],
  );
  const composerStore = useMemo(() => new ComposerStore(), []);
  const actionsRef = useRef<ComposerActions>({} as ComposerActions);

  const createNote = useCreateNote();
  const createChat = useCreateChat();
  const { enhance } = useTextEnhance();
  const { uploadFiles } = useFileUpload();
  const transcribeMutation = useTranscribe();
  const { mode, chatId } = useComposerMode();
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
    const scrollElement = scrollRef.current;
    if (!scrollElement || !inboxQuery.hasNextPage || inboxQuery.isFetchingNextPage) {
      return;
    }

    const distanceFromBottom =
      scrollElement.scrollHeight - scrollElement.clientHeight - scrollElement.scrollTop;

    if (distanceFromBottom <= FEED_ESTIMATED_ROW_HEIGHT * 4) {
      void inboxQuery.fetchNextPage();
    }
  }, [inboxQuery]);

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
      window.localStorage.removeItem(NOTES_NEW_DRAFT_STORAGE_KEY);
      return result;
    },
    sendMessage: async (_input) => {},
    createChat: async (input) => {
      const chat = await createChat.mutateAsync({ title: input.title });
      window.localStorage.removeItem(NOTES_NEW_DRAFT_STORAGE_KEY);
      return { id: chat.id };
    },
    enhanceText: ({ text, instruction }) => enhance({ text, instruction }),
    uploadFiles,
    navigate,
  };

  useEffect(() => {
    const saved = window.localStorage.getItem(NOTES_NEW_DRAFT_STORAGE_KEY);
    if (saved) {
      composerStore.dispatch({ type: 'SET_DRAFT', text: saved });
    }
  }, [composerStore]);

  useEffect(() => {
    return composerStore.subscribe(() => {
      const draft = composerStore.getSnapshot().draft;
      if (draft.length > 0) {
        window.localStorage.setItem(NOTES_NEW_DRAFT_STORAGE_KEY, draft);
        return;
      }

      window.localStorage.removeItem(NOTES_NEW_DRAFT_STORAGE_KEY);
    });
  }, [composerStore]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="flex min-h-0 w-full flex-1 flex-col border-t border-border-subtle">
        <div
          ref={setScrollElement}
          onScroll={() => {
            updateNearBottom();
            maybeLoadOlderItems();
          }}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden pb-40 md:pb-44"
        >
          {items.length === 0 ? (
            <div className="mx-auto w-full max-w-4xl px-4 py-5 md:px-6 lg:px-8">
              <EmptyState
                title="Your inbox is empty."
                description="Create a note or start a chat to get started."
                variant="dashed"
                size="lg"
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
              {inboxQuery.isFetchingNextPage ? (
                <div className="py-4 text-center text-sm text-text-tertiary">Loading more...</div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
      <Composer
        actionsRef={actionsRef}
        buildChatPath={(chatId) => `/chat/${chatId}`}
        mode={mode}
        chatId={chatId}
        store={composerStore}
        transcribeMutation={transcribeMutation}
        inlineVoiceEnabled={true}
      />
    </div>
  );
}
