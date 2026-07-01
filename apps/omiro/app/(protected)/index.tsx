import ExpoSegmentedControl from '@expo/ui/community/segmented-control';
import { Host, RNHostView } from '@expo/ui/swift-ui';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '~/components/composer/Composer';
import { makeStyles, useThemeColors } from '~/components/theme';
import {
  InboxList,
  type InboxListRef,
} from '~/components/inbox/InboxList';
import { useTopAnchoredInbox } from '~/services/inbox/top-anchored-inbox';
import { useInboxStreamItems } from '~/services/inbox/use-inbox-stream-items';
import {
  buildInboxSections,
  type InboxTab,
} from '~/services/inbox/screen-state';
import { clearInboxDraft, readInboxDraft, writeInboxDraft } from '~/services/navigation/launch-state';
import {
  getArchivedChatsRoute,
  getSettingsRoute,
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

  useTopAnchoredInbox({ listRef, headKey: items[0]?.id ?? null, isFocused });

  const handleOpenSettings = useCallback(() => router.push(getSettingsRoute()), [router]);

  const handleOpenArchivedChats = useCallback(
    () => router.push(getArchivedChatsRoute()),
    [router],
  );

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
          title: 'Inbox',
          headerSearchBarOptions: {
            placeholder: t.inbox.screen.searchPlaceholder,
            placement: 'stacked',
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
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel={t.inbox.screen.openMenuA11y}
          icon="person.crop.circle"
          title="Inbox"
        >
          <Stack.Toolbar.MenuAction icon="archivebox" onPress={handleOpenArchivedChats}>
            {t.inbox.screen.archivedChats}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="gearshape" onPress={handleOpenSettings}>
            {t.inbox.screen.settings}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <View style={styles.listWrap}>
        <InboxList
          contentPaddingBottom={insets.bottom + 164}
          contentPaddingTop={4}
          error={error}
          isFetchingNextPage={isFetchingNextPage}
          isLoading={isInitialLoading}
          items={displayItems}
          listRef={listRef}
          tab={activeTab}
          listHeader={
            <View style={styles.tabHeader}>
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
            </View>
          }
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
  tabHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  segmentedControl: {
    height: 32,
    width: 168,
  },
}));
