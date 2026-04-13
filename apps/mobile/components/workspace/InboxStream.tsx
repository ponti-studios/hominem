import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import React, { memo, useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View, type RefreshControlProps } from 'react-native';

import { Text, makeStyles } from '~/components/theme';

import { InboxStreamItem } from './InboxStreamItem';
import type { InboxStreamItemData as InboxStreamItemModel } from './InboxStreamItem.types';

interface InboxStreamProps {
  items: InboxStreamItemModel[];
  refreshControl?: React.ReactElement<RefreshControlProps>;
}

const keyExtractor = (item: InboxStreamItemModel) => `${item.kind}:${item.id}`;
const InboxStreamDivider = memo(() => {
  const styles = useStyles();

  return <View style={styles.divider} />;
});

InboxStreamDivider.displayName = 'InboxStreamDivider';

const RenderInboxStreamItem = memo(({ item }: { item: InboxStreamItemModel }) => {
  return <InboxStreamItem item={item} />;
});

RenderInboxStreamItem.displayName = 'RenderInboxStreamItem';

export const InboxStream = ({ items, refreshControl }: InboxStreamProps) => {
  const styles = useStyles();
  const listRef = useRef<any>(null);
  const prevCountRef = useRef(items.length);

  useEffect(() => {
    if (items.length > prevCountRef.current) {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
    prevCountRef.current = items.length;
  }, [items.length]);

  const renderItem = useCallback<ListRenderItem<InboxStreamItemModel>>(({ item }) => {
    return <RenderInboxStreamItem item={item} />;
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.empty}>
          <Text variant="bodyLarge" color="foreground">
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
          contentContainerStyle={styles.listContent}
          data={items}
          ItemSeparatorComponent={InboxStreamDivider}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListFooterComponent={<View style={styles.sectionFooter} />}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      paddingTop: t.spacing.sm_12,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      marginLeft: t.spacing.sm_12,
      marginRight: t.spacing.sm_12,
      backgroundColor: t.colors['border-subtle'],
    },
    sectionShell: {
      backgroundColor: t.colors['bg-base'],
      flex: 1,
      overflow: 'hidden',
    },
    listContent: {
      paddingTop: 0,
      paddingBottom: t.spacing.xl_64 + t.spacing.xl_64 + t.spacing.ml_24 + t.spacing.sm_12,
    },
    sectionFooter: {
      height: 2,
    },
    emptyWrap: {
      marginBottom:
        t.spacing.xl_64 + t.spacing.xl_64 + t.spacing.xl_64 + t.spacing.ml_24 + t.spacing.xs_4,
      marginHorizontal: t.spacing.m_16,
    },
    empty: {
      alignItems: 'center',
      backgroundColor: t.colors['bg-base'],
      gap: t.spacing.xs_4,
      paddingHorizontal: t.spacing.m_16,
      paddingVertical: t.spacing.l_32,
    },
  }),
);
