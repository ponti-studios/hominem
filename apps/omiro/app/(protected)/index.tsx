import type { FlashListRef } from '@shopify/flash-list';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import type { TextInput } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '~/components/composer/Composer';
import { makeStyles } from '~/components/theme';
import { WorkspaceHomeHeader } from '~/components/workspace/WorkspaceHomeHeader';
import { WorkspaceHomeList } from '~/components/workspace/WorkspaceHomeList';
import { WorkspaceSearchModal } from '~/components/workspace/WorkspaceSearchModal';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { recordWorkspaceScreenReady } from '~/services/performance/startup-metrics';
import {
  buildWorkspaceHomeSections,
  type WorkspaceHomeTab,
} from '~/services/workspace/home-screen-state';
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

function resolveFeedReadySignature({
  seed,
  hasDraft,
  consumeRestoreAttempt,
}: {
  seed?: string;
  hasDraft: boolean;
  consumeRestoreAttempt: () => boolean;
}) {
  if (seed) {
    return `seed:${hasDraft ? 'draft' : 'empty'}`;
  }

  if (hasDraft) {
    return 'default:draft';
  }

  if (consumeRestoreAttempt()) {
    return 'default:empty';
  }

  return null;
}

export default function FeedScreen() {
  const styles = useStyles();
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
  const listRef = useRef<FlashListRef<any>>(null);
  const searchInputRef = useRef<TextInput>(null);
  const readySignatureRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceHomeTab>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const feedDraft = readFeedDraft();
  const hasFeedDraft = feedDraft.trim().length > 0;

  useTopAnchoredFeed({ listRef, headKey: items[0]?.id ?? null, isFocused });

  useEffect(() => {
    if (!isFocused) {
      readySignatureRef.current = null;
      return;
    }

    const readySignature = resolveFeedReadySignature({
      seed: params.seed,
      hasDraft: hasFeedDraft,
      consumeRestoreAttempt: consumeWorkspaceRestoreAttempt,
    });
    if (!readySignature || readySignatureRef.current === readySignature) {
      return;
    }

    readySignatureRef.current = readySignature;
    recordWorkspaceScreenReady({ target: 'feed', restoreSource: 'default_feed' });
  }, [hasFeedDraft, isFocused, params.seed]);

  const handleOpenSettings = useCallback(() => router.push(getWorkspaceSettingsRoute()), [router]);

  const handleOpenArchivedChats = useCallback(
    () => router.push(getWorkspaceArchivedChatsRoute()),
    [router],
  );

  const handleOpenSearch = useCallback(() => setIsSearchVisible(true), []);

  const handleCloseSearch = useCallback(() => {
    setIsSearchVisible(false);
    setSearchQuery('');
  }, []);

  const { searchResults, visibleItems } = useMemo(
    () =>
      buildWorkspaceHomeSections({
        items,
        tab: activeTab,
        searchQuery,
      }),
    [activeTab, items, searchQuery],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <WorkspaceHomeHeader
        activeTab={activeTab}
        topInset={insets.top}
        onChangeTab={setActiveTab}
        onOpenArchivedChats={handleOpenArchivedChats}
        onOpenSearch={handleOpenSearch}
        onOpenSettings={handleOpenSettings}
      />

      <View style={styles.listWrap}>
        <WorkspaceHomeList
          contentPaddingBottom={insets.bottom + 164}
          error={error}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isInitialLoading}
          items={visibleItems}
          listRef={listRef}
          tab={activeTab}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
        />
      </View>

      <KeyboardStickyView
        offset={{ closed: 0, opened: 40 }}
        pointerEvents="box-none"
        style={styles.composerDock}
      >
        {/* oxfmt-ignore */}
        <View
          style={[
            styles.composerWrap,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <Composer
            mode="feed"
            entryMode={activeTab === 'chats' ? 'chat' : 'note'}
            initialMessage={feedDraft}
            onDraftChange={writeFeedDraft}
            onClearDraft={clearFeedDraft}
          />
        </View>
      </KeyboardStickyView>

      <WorkspaceSearchModal
        visible={isSearchVisible}
        searchInputRef={searchInputRef}
        searchQuery={searchQuery}
        results={searchResults}
        onClose={handleCloseSearch}
        onChangeSearchQuery={setSearchQuery}
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  composerDock: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  composerWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: 8,
  },
  container: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
}));
