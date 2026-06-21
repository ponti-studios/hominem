import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import type { RefreshControlProps } from 'react-native';
import { View } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui/EmptyState';
import type { WorkspaceHomeTab } from '~/services/workspace/home-screen-state';
import t from '~/translations';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData } from './InboxStreamItem.types';

type WorkspaceHomeListRow =
  | {
      type: 'section';
      id: string;
      title: string;
    }
  | {
      type: 'item';
      id: string;
      item: InboxStreamItemData;
      showKindLabel: boolean;
      showTimestamp: boolean;
      swipeEnabled: boolean;
      showLeadingIcon: boolean;
      variant: 'compact' | 'plain';
    };

interface WorkspaceHomeListProps {
  error?: Error | null;
  tab: WorkspaceHomeTab;
  items: InboxStreamItemData[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  listHeader?: React.ReactElement;
  listRef?: RefObject<FlashListRef<any> | null>;
  onEndReached?: () => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentPaddingBottom?: number;
  contentPaddingTop?: number;
}

const RenderInboxHomeItem = memo(
  ({
    item,
    showKindLabel,
    showTimestamp,
    swipeEnabled,
    showLeadingIcon,
    variant,
  }: {
    item: InboxStreamItemData;
    showKindLabel: boolean;
    showTimestamp: boolean;
    swipeEnabled: boolean;
    showLeadingIcon: boolean;
    variant: 'compact' | 'plain';
  }) => (
    <InboxStreamItem
      item={item}
      variant={variant}
      showKindLabel={showKindLabel}
      showTimestamp={showTimestamp}
      swipeEnabled={swipeEnabled}
      showLeadingIcon={showLeadingIcon}
    />
  ),
);

RenderInboxHomeItem.displayName = 'RenderInboxHomeItem';

function buildRows({
  items,
  tab,
}: Pick<WorkspaceHomeListProps, 'items' | 'tab'>): WorkspaceHomeListRow[] {
  return [
    {
      type: 'section' as const,
      id: `section:${tab}`,
      title: tab === 'notes' ? t.workspace.home.recentNotes : t.workspace.home.recentChats,
    },
    ...items.map((item) => ({
      type: 'item' as const,
      id: item.id,
      item,
      showKindLabel: false,
      showTimestamp: false,
      swipeEnabled: true,
      showLeadingIcon: false,
      variant: 'plain' as const,
    })),
  ];
}

export function WorkspaceHomeList({
  error,
  tab,
  items,
  isLoading = false,
  isFetchingNextPage = false,
  listHeader,
  listRef,
  onEndReached,
  refreshControl,
  contentPaddingBottom,
  contentPaddingTop,
}: WorkspaceHomeListProps) {
  const styles = useStyles();
  const rows = buildRows({ items, tab });

  const renderItem = useCallback<ListRenderItem<WorkspaceHomeListRow>>(
    ({ item }) => {
      if (item.type === 'section') {
        return <Text style={styles.sectionTitle}>{item.title}</Text>;
      }

      return (
        <RenderInboxHomeItem
          item={item.item}
          showKindLabel={item.showKindLabel}
          showTimestamp={item.showTimestamp}
          swipeEnabled={item.swipeEnabled}
          showLeadingIcon={item.showLeadingIcon}
          variant={item.variant}
        />
      );
    },
    [styles.sectionTitle],
  );

  if (error && items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {listHeader}
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
      </View>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {listHeader}
        <EmptyState
          description={
            tab === 'notes' ? t.workspace.home.emptyNotesDescription : t.workspace.empty.description
          }
          sfSymbol={tab === 'notes' ? 'doc.text' : 'bubble.left.and.bubble.right'}
          title={tab === 'notes' ? t.workspace.home.emptyNotesTitle : t.workspace.empty.title}
        />
      </View>
    );
  }

  return (
    <FlashList
      ref={listRef as React.Ref<FlashListRef<WorkspaceHomeListRow>>}
      contentContainerStyle={{
        paddingTop: contentPaddingTop ?? 0,
        paddingBottom: contentPaddingBottom ?? 16,
      }}
      data={rows}
      keyboardDismissMode="on-drag"
      keyExtractor={(item) => item.id}
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
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
    />
  );
}

const useStyles = makeStyles((theme) => ({
  emptyWrap: {
    flex: 1,
  },
  footerText: {
    paddingVertical: theme.spacing.lg,
    textAlign: 'center',
  },
  sectionTitle: {
    color: theme.colors.foreground,
    fontSize: theme.typography.sizes.xl,
    fontWeight: '700',
    letterSpacing: -0.3,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 28,
  },
}));
