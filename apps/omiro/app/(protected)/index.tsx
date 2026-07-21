import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '~/components/composer/Composer';
import { InboxList, type InboxListRef } from '~/components/inbox/InboxList';
import { TasksPane } from '~/components/tasks/TasksPane';
import { makeStyles, useThemeColors } from '~/components/theme';
import { IconButton } from '~/components/ui/icon-button';
import { SegmentedToggle } from '~/components/ui/segmented-toggle';
import { buildInboxSections, type InboxTab } from '~/services/inbox/screen-state';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import {
  clearInboxDraft,
  readInboxDraft,
  writeInboxDraft,
} from '~/services/navigation/launch-state';
import { getSettingsRoute } from '~/services/navigation/routes';
import t from '~/translations';

type InboxScreenTab = InboxTab | 'tasks';

const TAB_ICONS = {
  chats: require('~/assets/states/chats-tab-icon.png'),
  notes: require('~/assets/states/notes-tab-icon.png'),
  tasks: require('~/assets/states/tasks-tab-icon.png'),
} as const;

const TAB_TITLES: Record<InboxScreenTab, string> = {
  chats: t.inbox.screen.chatsTab,
  notes: t.inbox.screen.notesTab,
  tasks: t.inbox.screen.tasks,
};

export default function InboxScreen() {
  const styles = useStyles();
  const themeColors = useThemeColors();
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
  const listRef = useRef<InboxListRef>(null);
  const [activeTab, setActiveTab] = useState<InboxScreenTab>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const isTasksTab = activeTab === 'tasks';
  const isSearching = searchQuery.trim().length > 0;
  const inboxDraft = readInboxDraft();

  const handleOpenSettings = useCallback(() => router.push(getSettingsRoute()), [router]);
  const handleSearchCancel = useCallback(() => setSearchQuery(''), []);

  const { searchResults, visibleItems } = useMemo(
    () =>
      buildInboxSections({
        items,
        tab: isTasksTab ? 'notes' : activeTab,
        searchQuery,
      }),
    [activeTab, isTasksTab, items, searchQuery],
  );
  const displayItems = isSearching ? searchResults : visibleItems;

  // headerLeft is a single, structurally invariant toggle — always the same
  // three icons, whether search is idle or active. It never resizes or
  // swaps to a different component (Native chrome, Rule 81/82,
  // docs/03-experience.md): that reshaping, not merely `undefined`, is what
  // triggered iOS 26's leading-slot "More" ghost when this screen briefly
  // had a header-left that changed shape for an "All scope" search pill.
  const tabToggleOptions = useMemo(
    () => [
      {
        value: 'chats' as const,
        icon: TAB_ICONS.chats,
        accessibilityLabel: t.inbox.screen.chatsTab,
      },
      {
        value: 'notes' as const,
        icon: TAB_ICONS.notes,
        accessibilityLabel: t.inbox.screen.notesTab,
      },
      { value: 'tasks' as const, icon: TAB_ICONS.tasks, accessibilityLabel: t.inbox.screen.tasks },
    ],
    [],
  );
  const headerLeft = useCallback(
    () => (
      <SegmentedToggle
        onChange={setActiveTab}
        options={tabToggleOptions}
        testID="inbox-tab-control"
        value={activeTab}
      />
    ),
    [activeTab, tabToggleOptions],
  );
  const headerRight = useCallback(
    () => (
      <IconButton
        accessibilityLabel={t.inbox.screen.openSettingsA11y}
        icon="person.crop.circle"
        onPress={handleOpenSettings}
        testID="inbox-open-settings"
      />
    ),
    [handleOpenSettings],
  );
  const headerSearchBarOptions = useMemo(
    () => ({
      placeholder: isTasksTab
        ? t.inbox.screen.searchTasksPlaceholder
        : t.inbox.screen.searchPlaceholder,
      onCancelButtonPress: handleSearchCancel,
      onChangeText: (event: { nativeEvent: { text: string } }) =>
        setSearchQuery(event.nativeEvent.text),
      tintColor: themeColors.foreground,
    }),
    [handleSearchCancel, isTasksTab, themeColors.foreground],
  );
  const screenOptions = useMemo(
    () => ({
      headerShown: true as const,
      title: TAB_TITLES[activeTab],
      headerSearchBarOptions,
      headerLeft,
      headerRight,
    }),
    [activeTab, headerLeft, headerRight, headerSearchBarOptions],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={screenOptions} />

      <View style={styles.listWrap}>
        <View style={styles.listInner}>
          {isTasksTab ? (
            <TasksPane isFocused={isFocused} searchQuery={searchQuery} />
          ) : (
            <InboxList
              contentPaddingBottom={insets.bottom + 164}
              contentPaddingTop={4}
              error={error}
              isFetchingNextPage={isFetchingNextPage}
              isLoading={isInitialLoading}
              items={displayItems}
              listRef={listRef}
              tab={activeTab}
              onEndReached={() => {
                if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
              }}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} />}
            />
          )}
        </View>
      </View>

      {isTasksTab ? null : (
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
              mode="inbox"
              entryMode={activeTab === 'chats' ? 'chat' : 'note'}
              initialMessage={inboxDraft}
              onDraftChange={writeInboxDraft}
              onClearDraft={clearInboxDraft}
            />
          </View>
        </KeyboardStickyView>
      )}
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
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  container: {
    backgroundColor: theme.colors['bg-base'],
    flex: 1,
  },
  listInner: {
    flex: 1,
  },
  listWrap: {
    flex: 1,
  },
}));
