import ExpoSegmentedControl from '@expo/ui/community/segmented-control';
import { Host, RNHostView } from '@expo/ui/swift-ui';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '~/components/composer/Composer';
import { InboxList, type InboxListRef } from '~/components/inbox/InboxList';
import { makeStyles, useThemeColors } from '~/components/theme';
import { buildInboxSections, type InboxTab } from '~/services/inbox/screen-state';
import { useTopAnchoredInbox } from '~/services/inbox/top-anchored-inbox';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import {
  clearInboxDraft,
  readInboxDraft,
  writeInboxDraft,
} from '~/services/navigation/launch-state';
import {
  getArchivedChatsRoute,
  getSettingsRoute,
  getTasksRoute,
} from '~/services/navigation/routes';
import t from '~/translations';

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
  const [activeTab, setActiveTab] = useState<InboxTab>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const inboxDraft = readInboxDraft();
  const headKey = items[0]?.id ?? null;

  const { requestTopReveal } = useTopAnchoredInbox({ listRef, headKey, isFocused });

  // The list's initial scroll offset can land under the collapsing nav/search bar
  // header, hiding the top row until the user scrolls manually. Snap to the top
  // whenever the screen (re)gains focus or the first page of data becomes available.
  const previousFocusedRef = useRef(isFocused);
  useEffect(() => {
    if (isFocused && !previousFocusedRef.current) {
      requestTopReveal();
    }
    previousFocusedRef.current = isFocused;
  }, [isFocused, requestTopReveal]);

  const previousHeadKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (isFocused && headKey !== null && previousHeadKeyRef.current === null) {
      requestTopReveal();
    }
    previousHeadKeyRef.current = headKey;
  }, [headKey, isFocused, requestTopReveal]);

  const handleOpenSettings = useCallback(() => router.push(getSettingsRoute()), [router]);

  const handleOpenArchivedChats = useCallback(() => router.push(getArchivedChatsRoute()), [router]);

  const handleOpenTasks = useCallback(() => router.push(getTasksRoute()), [router]);

  const { searchResults, visibleItems } = useMemo(
    () =>
      buildInboxSections({
        items,
        tab: activeTab,
        searchQuery,
      }),
    [activeTab, items, searchQuery],
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
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.View hidesSharedBackground>
          <Host>
            <RNHostView matchContents>
              <ExpoSegmentedControl
                selectedIndex={activeTab === 'notes' ? 1 : 0}
                style={styles.segmentedControl}
                testID="inbox-tab-control"
                values={[t.inbox.screen.chatsTab, t.inbox.screen.notesTab]}
                onChange={(event) =>
                  setActiveTab(event.nativeEvent.selectedSegmentIndex === 1 ? 'notes' : 'chats')
                }
              />
            </RNHostView>
          </Host>
        </Stack.Toolbar.View>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel={t.inbox.screen.openMenuA11y}
          icon="person.crop.circle"
          title="Inbox"
        >
          <Stack.Toolbar.MenuAction icon="checklist" onPress={handleOpenTasks}>
            {t.inbox.screen.tasks}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="archivebox" onPress={handleOpenArchivedChats}>
            {t.inbox.screen.archivedChats}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="gearshape" onPress={handleOpenSettings}>
            {t.inbox.screen.settings}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <View style={styles.listWrap}>
        <View style={styles.listInner}>
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
        </View>
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
            mode="inbox"
            entryMode={activeTab === 'chats' ? 'chat' : 'note'}
            initialMessage={inboxDraft}
            onDraftChange={writeInboxDraft}
            onClearDraft={clearInboxDraft}
          />
        </View>
      </KeyboardStickyView>
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
  segmentedControl: {
    height: 32,
    width: 168,
  },
}));
