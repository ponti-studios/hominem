import type { FlashListRef } from '@shopify/flash-list';
import { Stack, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, View } from 'react-native';
import type { TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Text,
  fontFamiliesNative,
  fontSizes,
  makeStyles,
  shadowsNative,
  useThemeColors,
} from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { WorkspaceHomeHeader } from '~/components/workspace/WorkspaceHomeHeader';
import { WorkspaceHomeList } from '~/components/workspace/WorkspaceHomeList';
import { WorkspaceSearchModal } from '~/components/workspace/WorkspaceSearchModal';
import { DEFAULT_CHAT_TITLE } from '~/services/chat/chat-title';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { useTopAnchoredFeed } from '~/services/inbox/top-anchored-feed';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import { recordWorkspaceScreenReady } from '~/services/performance/startup-metrics';
import {
  buildWorkspaceHomeSections,
  type WorkspaceHomeTab,
} from '~/services/workspace/home-screen-state';
import { consumeWorkspaceRestoreAttempt, readFeedDraft } from '~/services/workspace/launch-state';
import {
  getWorkspaceArchivedChatsRoute,
  getWorkspaceArtifactRoute,
  getWorkspaceSettingsRoute,
} from '~/services/workspace/routes';
import t from '~/translations';

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
  const { mutateAsync: createChat, isPending: isCreatingChat } = useCreateChat();
  const listRef = useRef<FlashListRef<any>>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceHomeTab>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);

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

  const handleStartChat = useCallback(async () => {
    const chat = await createChat({ title: DEFAULT_CHAT_TITLE });
    router.push(getWorkspaceArtifactRoute('chat', chat.id));
  }, [createChat, router]);

  const { searchResults, visibleItems } = useMemo(
    () =>
      buildWorkspaceHomeSections({
        items,
        tab: activeTab,
        searchQuery,
      }),
    [activeTab, items, searchQuery],
  );

  const listHeader = useMemo(
    () => (
      <WorkspaceHomeHeader
        activeTab={activeTab}
        topInset={insets.top}
        onChangeTab={setActiveTab}
        onOpenArchivedChats={handleOpenArchivedChats}
        onOpenSearch={handleOpenSearch}
        onOpenSettings={handleOpenSettings}
      />
    ),
    [activeTab, handleOpenArchivedChats, handleOpenSearch, handleOpenSettings, insets.top],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <WorkspaceHomeList
        contentPaddingBottom={insets.bottom + 120}
        error={error}
        isFetchingNextPage={isFetchingNextPage}
        isLoading={isInitialLoading}
        items={visibleItems}
        listHeader={listHeader}
        listRef={listRef}
        tab={activeTab}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
        }}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
      />

      <Pressable
        accessibilityLabel={t.workspace.home.openChatA11y}
        accessibilityRole="button"
        disabled={isCreatingChat}
        onPress={() => void handleStartChat()}
        style={({ pressed }) => [
          styles.fabButton,
          { bottom: insets.bottom + 22 },
          (pressed || isCreatingChat) && styles.fabPressed,
        ]}
        testID="home-chat-action"
      >
        <View style={styles.fabSurface}>
          <AppIcon name="square.and.pencil" size={20} tintColor={themeColors.white} />
          <Text style={styles.fabLabel}>{t.workspace.home.chatAction}</Text>
        </View>
      </Pressable>

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
  container: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
  },
  fabButton: {
    position: 'absolute',
    right: 20,
  },
  fabLabel: {
    color: theme.colors.white,
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.xl,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  fabPressed: {
    opacity: 0.76,
  },
  fabSurface: {
    ...shadowsNative.medium,
    alignItems: 'center',
    backgroundColor: 'rgba(30, 30, 30, 0.96)',
    borderRadius: 31,
    columnGap: 12,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: 22,
  },
}));
