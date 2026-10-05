import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Composer } from '~/components/composer/Composer';
import { ComposerDock, useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { useStyles } from '~/components/theme';
import { PlannerSheets } from '~/components/time/PlannerSheets';
import { usePlanner } from '~/components/time/use-planner';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { clearAllDraft, readAllDraft, writeAllDraft } from '~/services/navigation/launch-state';
import { NOTES_ROUTE } from '~/services/navigation/routes';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData } from './InboxStreamItem.types';
import { SavedPopup } from './SavedPopup';
import { getEnteringItemIds } from './stream-rows';
import { StreamEmptyState } from './StreamEmptyState';
import { StreamLoadError } from './StreamLoadError';
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
  const [savedPopupId, setSavedPopupId] = useState<number | null>(null);
  const styles = useStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.background },
    // Without this, an unstyled FlashList nested in a `flex: 1` parent
    // isn't bounded to the space Yoga reserved for it -- it renders past
    // its own box and overlaps the composer dock sibling below it.
    list: { flex: 1 },
    content: { paddingBottom: 16 },
  }));

  const items = useMemo(
    () => inbox.items.filter((item) => item.kind === kind),
    [inbox.items, kind],
  );

  const { fetchNextPage, hasNextPage, isFetchingNextPage, isInitialLoading } = inbox;
  useEffect(() => {
    if (
      !isInitialLoading &&
      hasNextPage &&
      !isFetchingNextPage &&
      items.length < MIN_ROWS_BEFORE_IDLE_PAGING
    ) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isInitialLoading, items.length]);

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
      <FlashList
        style={styles.list}
        // The dock sits in flow below the list, so at rest nothing overlaps
        // the last row. Real reserved space (not `contentInset`, which only
        // affects overscroll) covers the dock riding up over the list while
        // the keyboard is open.
        contentContainerStyle={[styles.content, { paddingBottom: composerInset + 16 }]}
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
          ) : inbox.error ? (
            <StreamLoadError
              onRetry={() => {
                void inbox.refetch();
              }}
            />
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
      <ComposerDock restingInset={restingInset} testID={`${kind}-composer-dock`}>
        <View onLayout={(event) => setComposerHeight(event.nativeEvent.layout.height)}>
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
          />
        </View>
      </ComposerDock>
      <PlannerSheets planner={planner} />
    </View>
  );
}
