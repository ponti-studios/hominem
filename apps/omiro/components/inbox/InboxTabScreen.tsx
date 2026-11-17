import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Composer } from '~/components/composer/Composer';
import { ComposerDock, useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { ComposerReveal } from '~/components/composer/ComposerReveal';
import { useStyles } from '~/components/theme';
import { PlannerSheets } from '~/components/time/PlannerSheets';
import { usePlanner } from '~/components/time/use-planner';
import { AuroraBackground } from '~/components/ui/aurora-background';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { clearAllDraft, readAllDraft, writeAllDraft } from '~/services/navigation/launch-state';
import { NOTES_ROUTE } from '~/services/navigation/routes';
import { useSpotlightIndex } from '~/services/system/spotlight';
import t from '~/translations';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData } from './InboxStreamItem.types';
import { SavedPopup } from './SavedPopup';
import { filterStreamItems, getEnteringItemIds } from './stream-rows';
import { StreamEmptyState } from './StreamEmptyState';
import { StreamLoadError } from './StreamLoadError';
import { StreamSearchEmpty } from './StreamSearchEmpty';
import { StreamSkeleton } from './StreamSkeleton';

export type InboxTabKind = 'chat' | 'note';

// A page of the inbox that is mostly the other kind can leave this tab's list
// short of a screenful; keep paging until there is enough to scroll.
const MIN_ROWS_BEFORE_IDLE_PAGING = 12;

interface InboxTabScreenProps {
  kind: InboxTabKind;
}

// The Chat and Notes tabs: the same composer and the same list, filtered to
// one kind. The tab only picks the composer's starting kind; what the person
// types still decides where it lands, and a note saved from the Chat tab says
// so in a popup that jumps to Notes.
export function InboxTabScreen({ kind }: InboxTabScreenProps) {
  const router = useRouter();
  const { inset: composerInset, restingInset } = useComposerDockMetrics({
    clearance: 16,
  });
  const inbox = useInboxStreamItems();
  const planner = usePlanner();
  const [composerHeight, setComposerHeight] = useState(0);
  // The composer is folded away until the button opens it.
  const [composerOpen, setComposerOpen] = useState(false);
  const [savedPopupId, setSavedPopupId] = useState<number | null>(null);
  const styles = useStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.background },
    // Without this, an unstyled FlashList nested in a `flex: 1` parent
    // isn't bounded to the space Yoga reserved for it -- it renders past
    // its own box and overlaps the composer dock sibling below it.
    list: { flex: 1 },
    content: { paddingBottom: 16 },
    // The composer floats over the list rather than sitting below it.
    dockFloat: { bottom: 0, left: 0, position: 'absolute', right: 0 },
  }));

  const [query, setQuery] = useState('');
  const isSearching = query.trim().length > 0;
  useSpotlightIndex(inbox.items);

  const items = useMemo(
    () =>
      filterStreamItems(
        inbox.items.filter((item) => item.kind === kind),
        query,
      ),
    [inbox.items, kind, query],
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isInitialLoading } = inbox;
  useEffect(() => {
    if (
      !isInitialLoading &&
      hasNextPage &&
      !isFetchingNextPage &&
      // A search looks through everything, not just the pages loaded so far.
      (isSearching || items.length < MIN_ROWS_BEFORE_IDLE_PAGING)
    ) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isInitialLoading, isSearching, items.length]);

  // Seeded with whatever the first settled render holds (including empty),
  // then grows with every commit -- the same gating ChatMessageList uses so
  // historical rows never count as new.
  const [entry, setEntry] = useState<{
    source: InboxStreamItemData[];
    filtered: InboxStreamItemData[];
    seen: ReadonlySet<string>;
    entering: ReadonlySet<string>;
  } | null>(null);
  if (
    !inbox.isInitialLoading &&
    (entry === null || entry.source !== inbox.items || entry.filtered !== items)
  ) {
    const seen = new Set(entry?.seen);
    const entering = getEnteringItemIds(items, entry?.seen ?? new Set<string>());
    for (const item of inbox.items) {
      seen.add(item.id);
    }
    setEntry({ source: inbox.items, filtered: items, seen, entering });
  }
  const enteringIds: ReadonlySet<string> = entry?.entering ?? new Set<string>();

  const renderItem = useCallback<ListRenderItem<InboxStreamItemData>>(
    ({ item }) => <InboxStreamItem isNew={enteringIds.has(item.id)} item={item} />,
    [enteringIds],
  );

  // Only a note saved from Chat lands somewhere the person isn't looking.
  const handleNoteSaved = useCallback(() => {
    if (kind === 'chat') {
      setSavedPopupId(Date.now());
    }
  }, [kind]);

  return (
    <View style={styles.container} testID={`${kind}-tab-screen`}>
      {/* The system search field: it lives in the navigation bar and filters
          this tab as you type. */}
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            hideWhenScrolling: true,
            onCancelButtonPress: () => setQuery(''),
            onChangeText: (event) => setQuery(event.nativeEvent.text),
            placeholder: kind === 'chat' ? t.stream.search.chats : t.stream.search.notes,
          },
        }}
      />
      <AuroraBackground />
      <FlashList
        style={styles.list}
        // The list runs under the floating composer. Real reserved space (not
        // `contentInset`, which only affects overscroll) keeps the last row
        // clear of the composer at rest and while the keyboard lifts it.
        contentContainerStyle={[
          styles.content,
          { paddingBottom: composerHeight + restingInset + composerInset + 16 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        data={items}
        keyExtractor={(item) => item.id}
        // New rows land at the top of this list (an optimistic note, a fresh
        // chat). Keeping the visible row pinned would scroll the list away from
        // them, so let the content grow from the top instead.
        maintainVisibleContentPosition={{ disabled: true }}
        ListEmptyComponent={
          inbox.isInitialLoading ? (
            <StreamSkeleton />
          ) : inbox.error && inbox.items.length === 0 ? (
            <StreamLoadError
              onRetry={() => {
                void inbox.refetch();
              }}
            />
          ) : isSearching ? (
            <StreamSearchEmpty query={query.trim()} />
          ) : (
            <StreamEmptyState kind={kind} />
          )
        }
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) {
            void inbox.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl=<RefreshControl
          refreshing={inbox.isRefreshing}
          onRefresh={() => {
            void inbox.refetch();
          }}
        />
        renderItem={renderItem}
        scrollIndicatorInsets={{ bottom: composerInset }}
        showsVerticalScrollIndicator={false}
      />
      {savedPopupId === null ? null : (
        <SavedPopup
          bottom={composerInset + composerHeight + 8}
          key={savedPopupId}
          label="Saved to Notes"
          onDismiss={() => setSavedPopupId(null)}
          onOpen={() => {
            setSavedPopupId(null);
            router.navigate(NOTES_ROUTE);
          }}
        />
      )}
      <View pointerEvents="box-none" style={styles.dockFloat}>
        <ComposerDock restingInset={restingInset} testID={`${kind}-composer-dock`}>
          <View onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}>
            <ComposerReveal
              open={composerOpen}
              onOpen={() => setComposerOpen(true)}
              onClose={() => setComposerOpen(false)}
              openLabel={kind === 'chat' ? 'New message' : 'New note'}
              testID={`${kind}-composer`}
            >
              <Composer
                defaultEntryKind={kind}
                entryMode="mixed"
                initialMessage={readAllDraft()}
                isPlanning={planner.isPlanning}
                mode="inbox"
                onNoteSaved={handleNoteSaved}
                onPlan={planner.plan}
                onClearDraft={clearAllDraft}
                onDraftChange={writeAllDraft}
                onSent={() => setComposerOpen(false)}
              />
            </ComposerReveal>
          </View>
        </ComposerDock>
      </View>
      <PlannerSheets planner={planner} />
    </View>
  );
}
