import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Composer } from '~/components/composer/Composer';
import { ComposerDock, useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { useStyles } from '~/components/theme';
import { Chip } from '~/components/ui';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { clearAllDraft, readAllDraft, writeAllDraft } from '~/services/navigation/launch-state';
import { useTasksQuery } from '~/services/tasks/use-tasks-query';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData } from './InboxStreamItem.types';
import { getEnteringItemIds } from './stream-rows';
import { StreamEmptyState } from './StreamEmptyState';
import { StreamLoadError } from './StreamLoadError';
import { StreamSkeleton } from './StreamSkeleton';

export type StreamFilter = 'all' | 'chats' | 'notes';

export const streamFilterOptions: { key: StreamFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'chats', label: 'Chats' },
  { key: 'notes', label: 'Notes' },
];

function filterItems(items: InboxStreamItemData[], filter: StreamFilter): InboxStreamItemData[] {
  if (filter === 'all') {
    return items;
  }
  const kind = filter === 'chats' ? 'chat' : 'note';
  return items.filter((item) => item.kind === kind);
}

interface StreamScreenProps {
  filter: StreamFilter;
  onFilterChange: (filter: StreamFilter) => void;
}

export function StreamScreen({ filter, onFilterChange }: StreamScreenProps) {
  const { inset: composerInset, restingInset } = useComposerDockMetrics({
    clearance: 16,
  });
  const inbox = useInboxStreamItems();
  const { isFetching: isFetchingTasks, refetch: refetchTasks } = useTasksQuery();
  const styles = useStyles((theme) => ({
    container: { flex: 1, backgroundColor: theme.colors.background },
    // Without this, an unstyled FlashList nested in a `flex: 1` parent
    // isn't bounded to the space Yoga reserved for it -- it renders past
    // its own box and overlaps the composer dock sibling below it.
    list: { flex: 1 },
    content: { paddingBottom: 16 },
  }));

  const items = useMemo(() => filterItems(inbox.items, filter), [inbox.items, filter]);

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

  return (
    <View style={styles.container} testID="stream-screen">
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
        ListHeaderComponent=<StreamFilterChips onChange={onFilterChange} value={filter} />
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
            <StreamEmptyState filter={filter} />
          )
        }
        onEndReached={() => {
          if (inbox.hasNextPage && !inbox.isFetchingNextPage) {
            void inbox.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl=<RefreshControl
          refreshing={inbox.isRefreshing || isFetchingTasks}
          onRefresh={() => {
            void inbox.refetch();
            void refetchTasks();
          }}
        />
        renderItem={renderItem}
        scrollIndicatorInsets={{ bottom: composerInset }}
        showsVerticalScrollIndicator={false}
      />
      <ComposerDock restingInset={restingInset} testID="stream-composer-dock">
        <Composer
          entryMode="mixed"
          initialMessage={readAllDraft()}
          mode="inbox"
          onClearDraft={clearAllDraft}
          onDraftChange={writeAllDraft}
        />
      </ComposerDock>
    </View>
  );
}

function StreamFilterChips({
  onChange,
  value,
}: {
  onChange: (filter: StreamFilter) => void;
  value: StreamFilter;
}) {
  const styles = useStyles(() => ({
    row: { flexDirection: 'row', gap: 8, paddingBottom: 8, paddingHorizontal: 16, paddingTop: 4 },
  }));
  return (
    <View style={styles.row} testID="stream-filter">
      {streamFilterOptions.map((option) => (
        <Chip
          key={option.key}
          label={option.label}
          onPress={() => onChange(option.key)}
          testID={`stream-filter-${option.key}`}
          tone={option.key === value ? 'ink' : 'card'}
        />
      ))}
    </View>
  );
}
