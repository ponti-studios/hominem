import { useIsFocused } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router/build/hooks';
import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedComposer } from '~/components/feed/FeedComposer';
import { makeStyles } from '~/components/theme';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';

export default function FeedScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seed?: string }>();
  const { items, isLoading, refetch } = useInboxStreamItems({ enabled: isFocused });
  const listRef = React.useRef<FlashListRef<InboxStreamItemData> | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);

  const handleComposerLayout = useCallback((e: LayoutChangeEvent) => {
    const nextHeight = e.nativeEvent.layout.height;
    setComposerHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);

  useTopAnchoredFeed({
    listRef,
    headKey: items[0]?.id ?? null,
    isFocused,
  });

  return (
    <View style={styles.container}>
      <InboxStream
        listRef={listRef}
        items={items}
        contentPaddingBottom={composerHeight + insets.bottom}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      />
      <KeyboardStickyView
        offset={{ closed: insets.bottom, opened: 0 }}
        pointerEvents="box-none"
        style={styles.overlay}
      >
        <FeedComposer onLayout={handleComposerLayout} seedMessage={params.seed} />
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
}));
