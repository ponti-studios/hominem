import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import { ScrollView, StyleSheet, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles } from '~/components/theme';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamProps {
  items: InboxStreamItemModel[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  listRef?: RefObject<FlashListRef<InboxStreamItemModel> | null>;
  ListHeaderComponent?: React.ReactElement | null;
  onEndReached?: () => void;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentPaddingBottom?: number;
}

const keyExtractor = (item: InboxStreamItemModel) => `${item.kind}:${item.id}`;

const RenderInboxStreamItem = memo(({ item }: { item: InboxStreamItemModel }) => {
  return <InboxStreamItem item={item} />;
});

RenderInboxStreamItem.displayName = 'RenderInboxStreamItem';

export const InboxStream = ({
  items,
  isLoading = false,
  isFetchingNextPage = false,
  listRef,
  ListHeaderComponent,
  onEndReached,
  refreshControl,
  contentPaddingBottom,
}: InboxStreamProps) => {
  const styles = useStreamStyles();

  const renderItem = useCallback<ListRenderItem<InboxStreamItemModel>>(({ item }) => {
    return <RenderInboxStreamItem item={item} />;
  }, []);

  if (isLoading && items.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.loadingWrap,
          contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {Array.from({ length: 5 }, (_, index) => (
          <View key={`inbox-loading-row-${index.toString()}`} style={styles.loadingRow}>
            <View style={styles.loadingIcon} />
            <View style={styles.loadingCopy}>
              <View style={styles.loadingTitle} />
              <View style={styles.loadingMeta} />
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (items.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.emptyWrap,
          contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
        ]}
        showsVerticalScrollIndicator={false}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionShell}>
        <FlashList
          ref={listRef}
          contentContainerStyle={[
            staticStyles.listContent,
            contentPaddingBottom != null ? { paddingBottom: contentPaddingBottom } : null,
          ]}
          data={items}
          keyExtractor={keyExtractor}
          keyboardDismissMode="on-drag"
          renderItem={renderItem}
          ListHeaderComponent={ListHeaderComponent}
          ListFooterComponent={
            <View style={staticStyles.sectionFooter}>
              {isFetchingNextPage ? (
                <Text variant="caption1" color="text-tertiary" style={styles.footerText}>
                  Loading more...
                </Text>
              ) : null}
            </View>
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const useStreamStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
  },
  sectionShell: {
    flex: 1,
    overflow: 'hidden',
  },
  footerText: {
    textAlign: 'center',
  },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
  },
  loadingWrap: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    rowGap: theme.spacing.md,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: theme.spacing.md,
    minHeight: 56,
    paddingVertical: theme.spacing.sm,
  },
  loadingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors['border-subtle'],
  },
  loadingCopy: {
    flex: 1,
    rowGap: theme.spacing.sm,
  },
  loadingTitle: {
    height: 13,
    width: '58%',
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors['border-subtle'],
  },
  loadingMeta: {
    height: 11,
    width: '36%',
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors['border-faint'],
  },
}));

const staticStyles = StyleSheet.create({
  listContent: {
    paddingTop: 0,
    paddingBottom: 16,
  },
  sectionFooter: {
    height: 0,
  },
});
