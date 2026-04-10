import {
  MetaBadge,
  PreviewCard,
  SectionIntro,
  SurfaceFrame,
  SurfacePanel,
  StatePanel,
} from '@hominem/ui';
import { Composer, ComposerProvider, ComposerStore } from '@hominem/ui/composer';
import type { ComposerActions } from '@hominem/ui/composer';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Paperclip } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useCreateChat } from '~/hooks/use-chats';
import { useComposerMode } from '~/hooks/use-composer-mode';
import {
  flattenNoteFeedPages,
  useCreateNote,
  useNotesFeed,
  useUpdateNote,
} from '~/hooks/use-notes';
import { useTranscribe } from '~/hooks/use-transcribe';
import { useFileUpload } from '~/lib/hooks/use-file-upload';

import {
  completeNotesRowExit,
  NOTES_ROW_EXIT_REQUEST_EVENT,
  type NotesRowExitRequestDetail,
} from './notes-surface-events';
import { animateNotesRowEnter, animateNotesRowExit } from './notes-surface-motion';

const FEED_ESTIMATED_ROW_HEIGHT = 140;
const FEED_OVERSCAN_COUNT = 6;
const FEED_NEAR_BOTTOM_THRESHOLD = 96;
const FEED_LOAD_MORE_THRESHOLD_INDEX = 2;

type NoteFeedItem = ReturnType<typeof flattenNoteFeedPages>[number];

export default function NotesPage() {
  const feedQuery = useNotesFeed({ limit: 20 });
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
      <div className="px-4 pt-5">
        <SectionIntro
          title="Notes"
          description="The page stays where your hands are. Older notes stack above you."
          className="mb-5"
        />
      </div>
      <NotesFeed
        notes={notes}
        isLoading={feedQuery.isLoading}
        virtualizer={virtualizer}
        virtualItems={virtualItems}
        onScroll={updateNearBottom}
        setScrollElement={setScrollElement}
        animatedRowIdsRef={animatedRowIdsRef}
      />
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

interface NotesFeedProps {
  notes: NoteFeedItem[];
  isLoading: boolean;
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
  virtualItems: ReturnType<
    ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>['getVirtualItems']
  >;
  onScroll: () => void;
  setScrollElement: (element: HTMLDivElement | null) => void;
  animatedRowIdsRef: React.RefObject<Set<string>>;
}

const NotesFeed = ({
  notes,
  isLoading,
  virtualizer,
  virtualItems,
  onScroll,
  setScrollElement,
  animatedRowIdsRef,
}: NotesFeedProps) => {
  return (
    <SurfaceFrame className="mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-3xl">
      <div
        ref={setScrollElement}
        onScroll={onScroll}
        className="h-full min-h-0 w-full overflow-auto"
      >
        {isLoading ? (
          <SurfacePanel as="p" className="text-sm text-text-secondary">
            Loading notes...
          </SurfacePanel>
        ) : null}

        {!isLoading && notes.length === 0 ? (
          <div className="p-4">
            <StatePanel title="Start with a thought." />
          </div>
        ) : null}

        {notes.length > 0 ? (
          <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
            {virtualItems.map((virtualItem) => {
              const note = notes[virtualItem.index];
              if (!note) {
                return null;
              }

              return (
                <NotesFeedRow
                  key={virtualItem.key}
                  note={note}
                  virtualItem={virtualItem}
                  virtualizer={virtualizer}
                  animatedRowIdsRef={animatedRowIdsRef}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </SurfaceFrame>
  );
};

interface NotesFeedRowProps {
  note: NoteFeedItem;
  virtualItem: ReturnType<
    ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>['getVirtualItems']
  >[number];
  virtualizer: ReturnType<typeof useVirtualizer<HTMLDivElement, Element>>;
  animatedRowIdsRef: React.RefObject<Set<string>>;
}

function NotesFeedRow({ note, virtualItem, virtualizer, animatedRowIdsRef }: NotesFeedRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const exitRequestHandlerRef = useRef<((event: Event) => void) | null>(null);

  return (
    <div
      ref={(element) => {
        if (rowRef.current && exitRequestHandlerRef.current) {
          window.removeEventListener(NOTES_ROW_EXIT_REQUEST_EVENT, exitRequestHandlerRef.current);
          exitRequestHandlerRef.current = null;
        }

        rowRef.current = element;
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

        exitRequestHandlerRef.current = handleExitRequest;
        window.addEventListener(NOTES_ROW_EXIT_REQUEST_EVENT, handleExitRequest);
        virtualizer.measureElement(element);
        if (animatedRowIdsRef.current.has(note.id)) {
          return;
        }

        animatedRowIdsRef.current.add(note.id);
        animateNotesRowEnter(element);
      }}
      data-index={virtualItem.index}
      className="absolute left-0 top-0 w-full px-4 py-1"
      style={{ transform: `translateY(${virtualItem.start}px)` }}
    >
      <PreviewCard asChild interactive>
        <Link to={`/notes/${note.id}`}>
          <PreviewCard.Header
            meta={
              <>
                <div>{new Date(note.createdAt).toLocaleString()}</div>
                {note.metadata.hasAttachments ? (
                  <div className="mt-2">
                    <MetaBadge icon={<Paperclip className="size-3" />}>Files</MetaBadge>
                  </div>
                ) : null}
              </>
            }
          >
            <PreviewCard.Title className="line-clamp-2">
              {note.title || 'Untitled note'}
            </PreviewCard.Title>
            <PreviewCard.Description className="line-clamp-5">
              {note.contentPreview || 'No content yet.'}
            </PreviewCard.Description>
          </PreviewCard.Header>
        </Link>
      </PreviewCard>
    </div>
  );
}
