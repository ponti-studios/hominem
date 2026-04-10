import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { useInputContext } from '~/components/input/input-context';
import { InboxStream } from '~/components/workspace/inbox-stream';
import { makeStyles } from '~/components/theme';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';

export default function FeedScreen() {
  const styles = useStyles();
  const params = useLocalSearchParams<{ seed?: string }>();
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
        <InboxStream
          items={items}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={handleRefresh}
              tintColor={styles.refreshTint.color}
            />
          }
        />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    refreshTint: {
      color: t.colors['text-tertiary'],
    },
  }),
);
