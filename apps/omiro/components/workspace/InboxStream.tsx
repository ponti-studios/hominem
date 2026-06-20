import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import t from '~/translations';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamProps {
  error?: Error | null;
  items: InboxStreamItemModel[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  listHeader?: React.ReactElement;
  listRef?: RefObject<FlashListRef<InboxStreamItemModel> | null>;
  onEndReached?: () => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentPaddingBottom?: number;
  contentPaddingTop?: number;
  searchQuery?: string;
}

const keyExtractor = (item: InboxStreamItemModel) => `${item.kind}:${item.id}`;

const RenderInboxStreamItem = memo(({ item }: { item: InboxStreamItemModel }) => {
  return <InboxStreamItem item={item} />;
});

RenderInboxStreamItem.displayName = 'RenderInboxStreamItem';

export const InboxStream = ({
  error,
  items,
  isLoading = false,
  isFetchingNextPage = false,
  listHeader,
  listRef,
  onEndReached,
  refreshControl,
  contentPaddingBottom,
  contentPaddingTop,
  searchQuery = '',
}: InboxStreamProps) => {
  const styles = useStreamStyles();

  const filteredItems = searchQuery.trim()
    ? items.filter((item) => {
        const q = searchQuery.toLowerCase();
        return item.title?.toLowerCase().includes(q) || item.preview?.toLowerCase().includes(q);
      })
    : items;

  const renderItem = useCallback<ListRenderItem<InboxStreamItemModel>>(({ item }) => {
    return <RenderInboxStreamItem item={item} />;
  }, []);

  if (isLoading && filteredItems.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.loadingWrap,
          contentPaddingTop != null ? { paddingTop: contentPaddingTop } : null,
          contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <View key={`inbox-skeleton-${index.toString()}`} style={styles.skeletonCard}>
            <View style={styles.skeletonCardClip}>
              <View style={styles.skeletonBody}>
                <View style={styles.skeletonTitleRow}>
                  <View style={styles.skeletonIcon} />
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonTime} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (error && filteredItems.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.emptyWrap,
          contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
        ]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          action={
            refreshControl?.props.onRefresh
              ? {
                  label: t.workspace.home.retry,
                  onPress: refreshControl.props.onRefresh,
                }
              : undefined
          }
          description={t.workspace.home.loadErrorDescription}
          sfSymbol="arrow.clockwise.circle"
          title={t.workspace.home.loadErrorTitle}
        />
      </ScrollView>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.emptyWrap,
          contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
        ]}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        ref={listRef as React.Ref<FlashListRef<InboxStreamItemModel>>}
        contentContainerStyle={{
          paddingTop: contentPaddingTop != null ? contentPaddingTop : 8,
          paddingBottom: contentPaddingBottom != null ? contentPaddingBottom : 16,
        }}
        contentInsetAdjustmentBehavior="automatic"
        data={filteredItems}
        keyExtractor={keyExtractor}
        keyboardDismissMode="on-drag"
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={
          isFetchingNextPage ? (
            <Text variant="caption1" color="text-tertiary" style={styles.footerText}>
              Loading more...
            </Text>
          ) : null
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const useStreamStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
  },
  footerText: {
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  loadingWrap: {
    flexGrow: 1,
    paddingBottom: theme.spacing.lg,
  },
  skeletonCard: {
    marginHorizontal: 12,
    marginBottom: 4,
    borderRadius: 12,
  },
  skeletonCardClip: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: theme.colors['bg-surface'],
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  skeletonBody: {
    gap: 6,
  },
  skeletonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonIcon: {
    width: 13,
    height: 13,
    borderRadius: 3,
    backgroundColor: theme.colors['border-faint'],
    flexShrink: 0,
  },
  skeletonTitle: {
    height: 14,
    flex: 1,
    maxWidth: '65%',
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors['border-subtle'],
  },
  skeletonTime: {
    height: 10,
    width: 32,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors['border-faint'],
    flexShrink: 0,
  },
}));
