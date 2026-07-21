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
  const inboxDraft = readInboxDraft();
  const isTasksTab = activeTab === 'tasks';

  const handleOpenSettings = useCallback(() => router.push(getSettingsRoute()), [router]);

  const { searchResults, visibleItems } = useMemo(
    () =>
      buildInboxSections({
        items,
        tab: isTasksTab ? 'notes' : activeTab,
        searchQuery,
      }),
    [activeTab, isTasksTab, items, searchQuery],
  );
  const isSearching = searchQuery.trim().length > 0;
  const displayItems = isSearching ? searchResults : visibleItems;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '',
          headerSearchBarOptions: {
            placeholder: t.inbox.screen.searchPlaceholder,
            placement: 'integratedButton',
            allowToolbarIntegration: false,
            hideWhenScrolling: false,
            hideNavigationBar: false,
            obscureBackground: false,
            onCancelButtonPress: () => setSearchQuery(''),
            onChangeText: (event) => setSearchQuery(event.nativeEvent.text),
            tintColor: themeColors.foreground,
          },
          headerLeft: () => (
            <SegmentedToggle
              onChange={setActiveTab}
              options={[
                { label: t.inbox.screen.chatsTab, value: 'chats' },
                { label: t.inbox.screen.notesTab, value: 'notes' },
                { label: t.inbox.screen.tasks, value: 'tasks' },
              ]}
              testID="inbox-tab-control"
              value={activeTab}
            />
          ),
          headerRight: () => (
            <IconButton
              accessibilityLabel={t.inbox.screen.openSettingsA11y}
              icon="person.crop.circle"
              onPress={handleOpenSettings}
            />
          ),
        }}
      />

      <View style={styles.listWrap}>
        <View style={styles.listInner}>
          {isTasksTab ? (
            <TasksPane isFocused={isFocused} />
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
