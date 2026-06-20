import type { FlashListRef } from '@shopify/flash-list';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '~/components/composer/Composer';
import { makeStyles, useThemeColors } from '~/components/theme';
import { APP_NAME } from '~/constants';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { recordWorkspaceScreenReady } from '~/services/performance/startup-metrics';
import {
  clearFeedDraft,
  consumeWorkspaceRestoreAttempt,
  readFeedDraft,
  writeFeedDraft,
} from '~/services/workspace/launch-state';
import {
  getWorkspaceArchivedChatsRoute,
  getWorkspaceSettingsRoute,
} from '~/services/workspace/routes';

export default function FeedScreen() {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seed?: string }>();
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
  const [searchQuery, setSearchQuery] = useState('');

  const handleComposerLayout = useCallback((e: LayoutChangeEvent) => {
    const nextHeight = e.nativeEvent.layout.height;
    setComposerHeight((h) => (h === nextHeight ? h : nextHeight));
  }, []);

  useTopAnchoredFeed({ listRef, headKey: items[0]?.id ?? null, isFocused });

  useEffect(() => {
    if (!isFocused || params.seed) return;
    if (!consumeWorkspaceRestoreAttempt()) return;
    if (readFeedDraft().trim().length > 0) return;
    recordWorkspaceScreenReady({ target: 'feed', restoreSource: 'default_feed' });
  }, [isFocused, params.seed]);

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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: APP_NAME,
          headerLargeTitle: true,
          headerTitleAlign: 'left',
          headerTransparent: false,
        }}
      />
      <View style={styles.searchBar}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search"
          placeholderTextColor={themeColors['text-tertiary']}
          clearButtonMode="while-editing"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.searchInput, { color: themeColors['text-primary'] }]}
        />
      </View>
      <InboxStream
        error={error}
        listRef={listRef}
        items={items}
        isLoading={isInitialLoading}
        isFetchingNextPage={isFetchingNextPage}
        searchQuery={searchQuery}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        contentPaddingBottom={composerHeight + insets.bottom + 20}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="archivebox" onPress={handleOpenArchivedChats} />
        <Stack.Toolbar.Button icon="gearshape" onPress={handleOpenSettings} />
      </Stack.Toolbar>

      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        pointerEvents="box-none"
        style={[styles.overlay, { paddingBottom: insets.bottom + 10 }]}
      >
        <View onLayout={handleComposerLayout} style={styles.composerShell}>
          <Composer
            mode="feed"
            seedMessage={params.seed}
            initialDraft={readFeedDraft()}
            onDraftChange={writeFeedDraft}
            onClearDraft={clearFeedDraft}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors['border-faint'],
  },
  searchInput: {
    backgroundColor: theme.colors['bg-surface'],
    borderRadius: 10,
    fontSize: 16,
    height: 36,
    paddingHorizontal: 12,
  },
  overlay: {
    bottom: 0,
    left: 0,
    paddingHorizontal: 12,
    position: 'absolute',
    right: 0,
  },
  composerShell: {
    width: '100%',
  },
}));
