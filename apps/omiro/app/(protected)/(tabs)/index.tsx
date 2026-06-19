import { useIsFocused } from '@react-navigation/native';
import type { FlashListRef } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { RefreshControl, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedComposer } from '~/components/feed/FeedComposer';
import { makeStyles } from '~/components/theme';
import { InboxStream } from '~/components/workspace/InboxStream';
import type { InboxStreamItemData } from '~/components/workspace/InboxStreamItem.types';
import { WorkspaceHero } from '~/components/workspace/WorkspaceHero';
import { useCreateChat } from '~/services/chat/use-create-chat';
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
import t from '~/translations';

export default function FeedScreen() {
  const styles = useStyles();
  const isFocused = useIsFocused();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seed?: string }>();
  const resumeArtifact = readWorkspaceResumeArtifact();
  const {
    items,
    isInitialLoading,
    isRefreshing,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInboxStreamItems({ enabled: isFocused });
  const listRef = React.useRef<FlashListRef<InboxStreamItemData> | null>(null);
  const [composerHeight, setComposerHeight] = useState(0);
  const { mutateAsync: createChat } = useCreateChat();

  const handleComposerLayout = useCallback((e: LayoutChangeEvent) => {
    const nextHeight = e.nativeEvent.layout.height;
    setComposerHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);

  useTopAnchoredFeed({
    listRef,
    headKey: items[0]?.id ?? null,
    isFocused,
  });

  useEffect(() => {
    if (!isFocused || params.seed) {
      return;
    }

    if (!consumeWorkspaceRestoreAttempt()) {
      return;
    }

    if (readFeedDraft().trim().length > 0) {
      return;
    }
    recordWorkspaceScreenReady({
      target: 'feed',
      restoreSource: 'default_feed',
    });
  }, [isFocused, params.seed, router]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    if (params.seed) {
      recordWorkspaceScreenReady({
        target: 'feed',
        restoreSource: 'default_feed',
      });
      return;
    }

    if (readFeedDraft().trim().length > 0) {
      recordWorkspaceScreenReady({
        target: 'feed',
        restoreSource: 'default_feed',
      });
    }
  }, [isFocused, params.seed]);

  const handleStartChat = useCallback(() => {
    void createChat({ title: 'New conversation' }).then((chat) => {
      router.push(getWorkspaceArtifactRoute('chat', chat.id));
    });
  }, [createChat, router]);

  const handleOpenResume = useCallback(() => {
    if (!resumeArtifact) {
      return;
    }

    router.push(getWorkspaceArtifactRoute(resumeArtifact.kind, resumeArtifact.id));
  }, [resumeArtifact, router]);

  const handleOpenSettings = useCallback(() => {
    router.push(getWorkspaceSettingsRoute());
  }, [router]);

  const handleOpenArchivedChats = useCallback(() => {
    router.push(getWorkspaceArchivedChatsRoute());
  }, [router]);

  const hero = (
    <WorkspaceHero
      onOpenArchivedChats={handleOpenArchivedChats}
      onOpenSettings={handleOpenSettings}
      onResumeArtifact={resumeArtifact ? handleOpenResume : undefined}
      onStartChat={handleStartChat}
      resumeArtifact={resumeArtifact}
    />
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: t.workspace.home.title,
          headerLargeTitle: true,
        }}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="ellipsis.circle" title={t.workspace.home.title}>
          <Stack.Toolbar.MenuAction onPress={handleOpenSettings}>
            {t.workspace.home.settings}
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction onPress={handleOpenArchivedChats}>
            {t.workspace.home.archivedChats}
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>

      <View style={styles.container}>
        <InboxStream
          listRef={listRef}
          ListHeaderComponent={hero}
          items={items}
          isLoading={isInitialLoading}
          isFetchingNextPage={isFetchingNextPage}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
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
    </>
  );
}

const useStyles = makeStyles(() => ({
  container: {
    flex: 1,
  },
  overlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
}));
