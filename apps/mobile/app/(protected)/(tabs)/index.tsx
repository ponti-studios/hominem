import { Image } from 'expo-image';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import type { FlashListRef } from '@shopify/flash-list';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { makeStyles, theme } from '~/components/theme';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';

export default function FeedScreen() {
  const styles = useStyles();
  const router = useRouter();
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ seed?: string }>();
  const { items, isLoading, refetch } = useInboxStreamItems();
  const { setMessage } = useComposerContext();
  const listRef = React.useRef<FlashListRef<InboxStreamItemData> | null>(null);

  useTopAnchoredFeed({
    listRef,
    headKey: items[0]?.id ?? null,
    isFocused,
  });

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
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerLeft: () => (
            <Pressable
              onPress={() => router.push('/(protected)/(tabs)/notes' as RelativePathString)}
              hitSlop={8}
              accessibilityLabel="Notes"
            >
              <Image
                source="sf:note.text"
                style={{ width: 22, height: 22 }}
                tintColor={theme.colors.foreground}
                contentFit="contain"
              />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(protected)/(tabs)/settings' as RelativePathString)}
              hitSlop={8}
              accessibilityLabel="Settings"
            >
              <Image
                source="sf:gearshape"
                style={{ width: 22, height: 22 }}
                tintColor={theme.colors.foreground}
                contentFit="contain"
              />
            </Pressable>
          ),
        }}
      />
        <InboxStream
          listRef={listRef}
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
    },
    refreshTint: {
      color: t.colors['text-tertiary'],
    },
  }),
);
