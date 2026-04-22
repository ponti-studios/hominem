import { FlashList, type FlashListRef, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, type RefObject } from 'react';
import { StyleSheet, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles } from '~/components/theme';
import { spacing } from '~/components/theme/tokens';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamProps {
  items: InboxStreamItemModel[];
  listRef?: RefObject<FlashListRef<InboxStreamItemModel> | null>;
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

const keyExtractor = (item: InboxStreamItemModel) => `${item.kind}:${item.id}`;

const InboxStreamDivider = memo(() => {
  const styles = useStreamStyles();
  return <View style={styles.divider} />;
});

InboxStreamDivider.displayName = 'InboxStreamDivider';

const RenderInboxStreamItem = memo(({ item }: { item: InboxStreamItemModel }) => {
  return <InboxStreamItem item={item} />;
});

RenderInboxStreamItem.displayName = 'RenderInboxStreamItem';

export const InboxStream = ({ items, listRef, refreshControl }: InboxStreamProps) => {
  const styles = useStreamStyles();

  const renderItem = useCallback<ListRenderItem<InboxStreamItemModel>>(({ item }) => {
    return <RenderInboxStreamItem item={item} />;
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.empty}>
          <Text variant="body" color="foreground">
            Start with a thought
          </Text>
          <Text variant="body" color="text-secondary">
            New notes and conversations will appear here together.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionShell}>
        <FlashList
          ref={listRef}
          contentContainerStyle={staticStyles.listContent}
          data={items}
          ItemSeparatorComponent={InboxStreamDivider}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={<View style={staticStyles.sectionFooter} />}
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
    paddingTop: spacing[3],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing[3],
    marginRight: spacing[3],
    backgroundColor: theme.colors['border-subtle'],
  },
  sectionShell: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
    overflow: 'hidden',
  },
  emptyWrap: {
    marginBottom: spacing[8] + spacing[8] + spacing[8] + spacing[5] + spacing[1],
    marginHorizontal: spacing[4],
  },
  empty: {
    alignItems: 'center',
    backgroundColor: theme.colors['bg-base'],
    gap: spacing[1],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[6],
  },
}));

const staticStyles = StyleSheet.create({
  listContent: {
    paddingTop: 0,
    paddingBottom: spacing[8] + spacing[8] + spacing[5] + spacing[3],
  },
  sectionFooter: {
    height: 2,
  },
});
