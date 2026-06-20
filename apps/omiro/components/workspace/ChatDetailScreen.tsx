import type { SessionSource } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, View, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChatMessageList,
  ChatReviewOverlay,
  ChatSearchModal,
  useChatController,
  type ChatRenderIcon,
  type ChatServices,
} from '~/components/chat';
import { Composer } from '~/components/composer/Composer';
import { buildConversationActionsModel } from '~/components/chat/conversation-actions.model';
import { EmptyState } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import {
  DEFAULT_CHAT_TITLE,
  getChatTitle,
  updateChatTitleCaches,
  useActiveChat,
  useArchiveChat,
  useChatMessages,
  useSendMessage,
} from '~/services/chat';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { useCreateChat } from '~/services/chat/use-create-chat';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import { chatKeys } from '~/services/notes/query-keys';
import { recordWorkspaceScreenReady } from '~/services/performance/startup-metrics';
import { writeWorkspaceResumeArtifact } from '~/services/workspace/launch-state';
import { getWorkspaceArtifactRoute, getWorkspaceHomeRoute } from '~/services/workspace/routes';
import t from '~/translations';

const renderChatIcon: ChatRenderIcon = (name, props) => {
  const tintColor = props.color;
  return (
    <View style={props.style}>
      <AppIcon name={name} size={props.size} tintColor={tintColor} />
    </View>
  );
};

export function ChatDetailScreen() {
  const { id, initialMessage } = useLocalSearchParams<{ id: string; initialMessage?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: activeChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const [composerHeight, setComposerHeight] = useState(0);
  const homeRoute = getWorkspaceHomeRoute();

  useEffect(() => {
    recordWorkspaceScreenReady({
      target: 'chat',
      restoreSource: 'last_open_route',
    });
  }, []);

  const handleComposerLayout = useCallback((e: LayoutChangeEvent) => {
    const nextHeight = e.nativeEvent.layout.height;
    setComposerHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);

  const services = useMemo<ChatServices>(
    () => ({
      useArchiveChat,
      useChatMessages,
      useSendMessage,
      onArtifactCreated: async ({ source, updatedAt }) => {
        updateChatTitleCaches(queryClient, {
          chatId,
          title: source.title,
          updatedAt,
        });
        await invalidateInboxQueries(queryClient);
      },
      chatKeys: {
        messages: chatKeys.messages,
      },
    }),
    [chatId, queryClient],
  );

  const source = useMemo<SessionSource>(() => {
    if (activeChat?.noteId) {
      return {
        kind: 'artifact',
        id: activeChat.noteId,
        title: activeChat.title,
        type: 'note',
      };
    }

    return { kind: 'new' };
  }, [activeChat]);

  const controller = useChatController({
    chatId,
    onChatArchive: () => {
      router.replace(homeRoute);
    },
    services,
    source,
  });

  const displayTitle = getChatTitle(activeChat?.title, controller.resolvedSource);
  const { mutateAsync: createChat, isPending: isCreatingChat } = useCreateChat();

  useEffect(() => {
    writeWorkspaceResumeArtifact({
      kind: 'chat',
      id: chatId,
      title: displayTitle,
      updatedAt: activeChat?.updatedAt ?? null,
    });
  }, [activeChat?.updatedAt, chatId, displayTitle]);

  const handleBackPress = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }

    router.replace(homeRoute);
  }, [homeRoute, navigation, router]);

  const conversationActions = useMemo(
    () =>
      buildConversationActionsModel({
        canTransform: controller.canTransform,
        isArchiving: controller.isArchiving,
        showDebug: controller.showDebug,
      }),
    [controller.canTransform, controller.isArchiving, controller.showDebug],
  );

  const emptyState = useMemo(
    () => (
      <EmptyState
        sfSymbol="bubble.left"
        title={t.chat.emptyState.title}
        description={t.chat.emptyState.description}
      />
    ),
    [],
  );
  const errorState = useMemo(
    () => (
      <EmptyState
        action={{ label: t.chat.loadErrorRetry, onPress: () => void controller.refetchMessages() }}
        sfSymbol="arrow.clockwise.circle"
        title={t.chat.loadErrorTitle}
        description={t.chat.loadErrorDescription}
      />
    ),
    [controller],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: displayTitle,
          headerBackVisible: false,
          headerTitleAlign: 'center',
        }}
      />
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button
          accessibilityLabel="Back"
          icon="chevron.left"
          onPress={handleBackPress}
        />
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel={t.chat.conversationActionsLabel}
          icon="ellipsis.circle"
          title={t.chat.conversationActionsLabel}
        >
          {conversationActions.flatMap((section) =>
            section.items.map((item) => {
              if (item.kind === 'search') {
                return (
                  <Stack.Toolbar.MenuAction
                    key={`${section.title}:${item.label}`}
                    onPress={controller.handleOpenSearch}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                );
              }

              if (item.kind === 'toggle-debug') {
                return (
                  <Stack.Toolbar.MenuAction
                    key={`${section.title}:${item.label}`}
                    onPress={controller.handleToggleDebug}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                );
              }

              if (item.kind === 'transform' && item.type) {
                return (
                  <Stack.Toolbar.MenuAction
                    key={`${section.title}:${item.label}`}
                    onPress={() => controller.handleTransformFromMenu(item.type!)}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                );
              }

              return (
                <Stack.Toolbar.MenuAction
                  key={`${section.title}:${item.label}`}
                  destructive
                  onPress={controller.handleArchiveChat}
                >
                  {item.label}
                </Stack.Toolbar.MenuAction>
              );
            }),
          )}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          accessibilityLabel="New chat"
          disabled={isCreatingChat}
          icon="square.and.pencil"
          onPress={() => {
            void createChat({ title: DEFAULT_CHAT_TITLE }).then((chat) => {
              router.push(getWorkspaceArtifactRoute('chat', chat.id));
            });
          }}
        />
      </Stack.Toolbar>

      <View style={styles.container}>
        <ChatSearchModal
          visible={controller.showSearch}
          searchQuery={controller.searchQuery}
          resultCount={controller.displayMessages.length}
          searchInputRef={controller.searchInputRef}
          onClose={controller.handleCloseSearch}
          onChangeSearchQuery={controller.handleSearchQueryChange}
        />
        <ChatMessageList
          isMessagesLoading={controller.isMessagesLoading}
          displayMessages={controller.displayMessages}
          showSearch={controller.showSearch}
          searchQuery={controller.searchQuery}
          markdown={controller.Markdown}
          showDebug={controller.showDebug}
          onCopy={controller.handleCopyMessage}
          onShare={(message: Parameters<typeof controller.handleShareMessage>[0]) => {
            void controller.handleShareMessage(message);
          }}
          renderIcon={renderChatIcon}
          formatTimestamp={formatRelativeAge}
          contentPaddingBottom={composerHeight + insets.bottom}
          emptyState={controller.messagesError ? errorState : emptyState}
          refreshControl={
            <RefreshControl
              refreshing={controller.isMessagesRefreshing}
              onRefresh={() => {
                void controller.refetchMessages();
              }}
            />
          }
        />
        <KeyboardStickyView
          offset={{ closed: 0, opened: 0 }}
          pointerEvents="box-none"
          style={[styles.composerOverlay, { paddingBottom: insets.bottom + 10, paddingHorizontal: 12 }]}
        >
          <View onLayout={handleComposerLayout}>
            <Composer mode="chat" chatId={chatId} seedMessage={initialMessage} />
          </View>
        </KeyboardStickyView>
        <View style={styles.reviewOverlay}>
          <ChatReviewOverlay
            pendingReview={controller.pendingReview}
            isVisible={controller.isReviewVisible}
            onAccept={() => {
              void controller.handleAcceptReview();
            }}
            onReject={() => {
              void controller.handleRejectReview();
            }}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reviewOverlay: {
    bottom: 0,
    left: 0,
    top: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
  },
  composerOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
  },
});
