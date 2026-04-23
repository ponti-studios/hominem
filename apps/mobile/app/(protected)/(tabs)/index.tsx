import type { FlashListRef } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';

export default function FeedScreen() {
  const styles = useStyles();
  const themeColors = useThemeColors();
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

  const handleOpenNotes = useCallback(() => {
    router.push('/(protected)/(tabs)/notes' as RelativePathString);
  }, [router]);

  const handleOpenSettings = useCallback(() => {
    router.push('/(protected)/(tabs)/settings' as RelativePathString);
  }, [router]);

  const handleSelectStarter = useCallback(
    (prompt: string) => {
      setMessage(prompt);
    },
    [setMessage],
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: true,
      title: '',
      headerLeft: () => (
        <Pressable onPress={handleOpenNotes} hitSlop={8} accessibilityLabel="Notes">
          <Image
            source="sf:note.text"
            style={{ width: 22, height: 22 }}
            tintColor={themeColors.foreground}
            contentFit="contain"
          />
        </Pressable>
      ),
      headerRight: () => (
        <Pressable onPress={handleOpenSettings} hitSlop={8} accessibilityLabel="Settings">
          <Image
            source="sf:gearshape"
            style={{ width: 22, height: 22 }}
            tintColor={themeColors.foreground}
            contentFit="contain"
          />
        </Pressable>
      ),
    }),
    [handleOpenNotes, handleOpenSettings, themeColors],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={screenOptions} />
      <InboxStream
        listRef={listRef}
        items={items}
        onSelectStarter={handleSelectStarter}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={handleRefresh}
            tintColor={themeColors['text-tertiary']}
          />
        }
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
}));
