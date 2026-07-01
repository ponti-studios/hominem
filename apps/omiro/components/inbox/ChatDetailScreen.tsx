import type { SessionSource } from '@hominem/rpc/types';
import { useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
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
import { buildConversationActionsModel } from '~/components/chat/conversation-actions.model';
import { Composer } from '~/components/composer/Composer';
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
import { useCreateChat } from '~/services/chat/use-create-chat';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import { invalidateInboxQueries } from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';
import { writeResumeTarget } from '~/services/navigation/launch-state';
import { getContentRoute, getInboxRoute } from '~/services/navigation/routes';
import t from '~/translations';

function getConversationActionIcon(kind: string, type?: string) {
  if (kind === 'search') return 'magnifyingglass';
  if (kind === 'toggle-debug') return 'ladybug';
  if (kind === 'archive') return 'archivebox';
  if (type === 'note') return 'doc.text';
  if (type === 'task') return 'checkmark.circle';
  if (type === 'task_list') return 'checklist';
  return 'ellipsis.circle';
}

const renderChatIcon: ChatRenderIcon = (name, props) => {
  const tintColor = props.color;
  return (
    <View style={props.style}>
      <AppIcon name={name} size={props.size} tintColor={tintColor} />
    </View>
  );
};

export function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { data: activeChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const [composerHeight, setComposerHeight] = useState(0);
  const canGoBack = navigation.canGoBack();

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
      onContentCreated: async ({ source, updatedAt }) => {
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
    onChatArchive: () => router.replace(getInboxRoute()),
    services,
    source,
  });

  const displayTitle = getChatTitle(activeChat?.title, controller.resolvedSource);
  const { mutateAsync: createChat, isPending: isCreatingChat } = useCreateChat();

  useEffect(() => {
    writeResumeTarget({
      kind: 'chat',
      id: chatId,
      title: displayTitle,
      updatedAt: activeChat?.updatedAt ?? null,
    });
  }, [activeChat?.updatedAt, chatId, displayTitle]);

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
          headerBackButtonDisplayMode: 'minimal',
          headerBackVisible: canGoBack,
        }}
      />
      {!canGoBack ? (
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button icon="chevron.left" onPress={() => router.replace(getInboxRoute())}>
            Inbox
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      ) : null}
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          accessibilityLabel={t.chat.conversationActionsLabel}
          icon="ellipsis.circle"
          title={displayTitle}
        >
          {conversationActions.map((section) =>
            section.items.map((item) => {
              if (item.kind === 'search') {
                return (
                  <Stack.Toolbar.MenuAction
                    key={item.kind}
                    icon={getConversationActionIcon(item.kind)}
                    onPress={controller.handleOpenSearch}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                );
              }

              if (item.kind === 'toggle-debug') {
                return (
                  <Stack.Toolbar.MenuAction
                    key={item.kind}
                    icon={getConversationActionIcon(item.kind)}
                    isOn={controller.showDebug}
                    onPress={controller.handleToggleDebug}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                );
              }

              if (item.kind === 'transform' && item.type) {
                return (
                  <Stack.Toolbar.MenuAction
                    key={`${item.kind}:${item.type}`}
                    icon={getConversationActionIcon(item.kind, item.type)}
                    onPress={() => {
                      if (!item.type) {
                        return;
                      }

                      controller.handleTransformFromMenu(item.type);
                    }}
                  >
                    {item.label}
                  </Stack.Toolbar.MenuAction>
                );
              }

              return (
                <Stack.Toolbar.MenuAction
                  key={item.kind}
                  destructive={item.kind === 'archive'}
                  icon={getConversationActionIcon(item.kind)}
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
              router.push(getContentRoute('chat', chat.id));
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
          style={[
            styles.composerOverlay,
            { paddingBottom: insets.bottom + 10, paddingHorizontal: 12 },
          ]}
        >
          <View onLayout={handleComposerLayout}>
            <Composer mode="chat" chatId={chatId} />
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
