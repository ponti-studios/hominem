import { useIsFocused } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedComposer } from '~/components/feed/FeedComposer';
import { useThemeColors } from '~/components/theme';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import AppIcon from '~/components/ui/icon';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { recordWorkspaceScreenReady } from '~/services/performance/startup-metrics';
import {
  consumeWorkspaceRestoreAttempt,
  readFeedDraft,
  readWorkspaceResumeArtifact,
} from '~/services/workspace/launch-state';
import {
  getWorkspaceArchivedChatsRoute,
  getWorkspaceArtifactRoute,
  getWorkspaceSettingsRoute,
} from '~/services/workspace/routes';

export default function FeedScreen() {
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const params = useLocalSearchParams<{ seed?: string }>();
  readWorkspaceResumeArtifact();
  const {
    error,
    items,
    isInitialLoading,
    isRefreshing,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInboxStreamItems({ enabled: isFocused });
  const listRef = React.useRef<FlashListRef<InboxStreamItemData>>(null);
  const [composerHeight, setComposerHeight] = useState(0);

  const handleComposerLayout = useCallback((e: LayoutChangeEvent) => {
    const nextHeight = e.nativeEvent.layout.height;
    setComposerHeight((h) => (h === nextHeight ? h : nextHeight));
  }, []);

  useTopAnchoredFeed({
    listRef,
    headKey: items[0]?.id ?? null,
    isFocused,
  });

  useEffect(() => {
    if (!isFocused || params.seed) return;
    if (!consumeWorkspaceRestoreAttempt()) return;
    if (readFeedDraft().trim().length > 0) return;
    recordWorkspaceScreenReady({ target: 'feed', restoreSource: 'default_feed' });
  }, [isFocused, params.seed, router]);

  useEffect(() => {
    if (!isFocused) return;
    if (params.seed) {
      recordWorkspaceScreenReady({ target: 'feed', restoreSource: 'default_feed' });
      return;
    }
    if (readFeedDraft().trim().length > 0) {
      recordWorkspaceScreenReady({ target: 'feed', restoreSource: 'default_feed' });
    }
  }, [isFocused, params.seed]);

  const handleOpenSettings = useCallback(() => {
    router.push(getWorkspaceSettingsRoute());
  }, [router]);

  const handleOpenArchivedChats = useCallback(() => {
    router.push(getWorkspaceArchivedChatsRoute());
  }, [router]);

  const handleOpenResume = useCallback(() => {
    const resumeArtifact = readWorkspaceResumeArtifact();
    if (!resumeArtifact) return;
    router.push(getWorkspaceArtifactRoute(resumeArtifact.kind, resumeArtifact.id));
  }, [router]);

  void handleOpenResume;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                accessibilityLabel="Archived chats"
                hitSlop={10}
                onPress={handleOpenArchivedChats}
              >
                <AppIcon
                  name="archivebox"
                  size={20}
                  tintColor={themeColors['icon-primary']}
                />
              </Pressable>
              <Pressable
                accessibilityLabel="Settings"
                hitSlop={10}
                onPress={handleOpenSettings}
              >
                <AppIcon
                  name="gearshape"
                  size={20}
                  tintColor={themeColors['icon-primary']}
                />
              </Pressable>
            </View>
          ),
        }}
      />
      <InboxStream
        error={error}
        listRef={listRef}
        items={items}
        isLoading={isInitialLoading}
        isFetchingNextPage={isFetchingNextPage}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
