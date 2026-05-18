import { useIsFocused } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router/build/hooks';
import React, { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { RefreshControl, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedComposer } from '~/components/feed/FeedComposer';
import { makeStyles } from '~/components/theme';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { recordWorkspaceScreenReady } from '~/services/performance/startup-metrics';
import {
  consumeWorkspaceRestoreAttempt,
  readFeedDraft,
  readLastOpenWorkspaceRoute,
} from '~/services/workspace/launch-state';

export default function FeedScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seed?: string }>();
  const { items, isInitialLoading, isRefreshing, refetch } = useInboxStreamItems({
    enabled: isFocused,
  });
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

  useEffect(() => {
    if (!isFocused || params.seed) {
      return;
    }

    if (!consumeWorkspaceRestoreAttempt()) {
      return;
    }

    if (readFeedDraft().trim().length > 0) {
      return;
    }

    const lastRoute = readLastOpenWorkspaceRoute();
    if (!lastRoute || lastRoute === '/(protected)/(tabs)') {
      recordWorkspaceScreenReady({
        target: 'feed',
        restoreSource: 'default_feed',
      });
      return;
    }

    router.replace(lastRoute);
  }, [isFocused, params.seed, router]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (params.seed) {
      recordWorkspaceScreenReady({
        target: 'feed',
        restoreSource: 'default_feed',
      });
      return;
    }

    if (readFeedDraft().trim().length > 0) {
      recordWorkspaceScreenReady({
        target: 'feed',
        restoreSource: 'default_feed',
      });
    }
  }, [isFocused, params.seed]);

  return (
    <View style={styles.container}>
      <InboxStream
        listRef={listRef}
        items={items}
        isLoading={isInitialLoading}
        contentPaddingBottom={composerHeight + insets.bottom}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
      />
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        pointerEvents="box-none"
        style={styles.overlay}
      >
        <View onLayout={handleComposerLayout}>
          <FeedComposer seedMessage={params.seed} />
        </View>
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
