import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { InboxStream } from '~/components/workspace/inbox-stream';
import { useInputContext } from '~/components/input/input-context';
import { theme } from '~/theme';
import { useInboxStreamItems } from '~/utils/services/inbox/use-inbox-stream-items';

export default function FeedScreen() {
  const params = useLocalSearchParams<{ seed?: string; action?: string }>();
  const { items, isLoading, refetch } = useInboxStreamItems();
  const { setMessage } = useInputContext();

  useEffect(() => {
    if (params.seed) {
      setMessage(params.seed);
    }
  }, [params.seed, setMessage]);

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <View style={styles.container}>
      <InboxStream items={items} refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} tintColor={theme.colors['text-tertiary']} />
      } />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
