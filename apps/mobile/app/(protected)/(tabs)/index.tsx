import { useIsFocused } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { useLocalSearchParams } from 'expo-router/build/hooks';
import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { FeedComposer } from '~/components/feed/FeedComposer';
import { makeStyles } from '~/components/theme';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';

export default function FeedScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ seed?: string }>();
  const { items, isLoading, refetch } = useInboxStreamItems({ enabled: isFocused });
  const listRef = React.useRef<FlashListRef<InboxStreamItemData> | null>(null);
  const [composerClearance, setComposerClearance] = useState(0);

  useTopAnchoredFeed({
    listRef,
    headKey: items[0]?.id ?? null,
    isFocused,
  });

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <View style={styles.container}>
      <InboxStream
        listRef={listRef}
        items={items}
        contentPaddingBottom={composerClearance}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
      />
      <FeedComposer onClearanceChange={setComposerClearance} seedMessage={params.seed} />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
}));
