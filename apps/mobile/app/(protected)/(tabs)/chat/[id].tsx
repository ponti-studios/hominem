import { useApiClient } from '@hominem/rpc/react';
import type { SessionSource } from '@hominem/rpc/types';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router/build/hooks';
import React, { useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  ChatMessageList,
  ChatReviewOverlay,
  ChatSearchModal,
  ConversationActionsSheet,
  useChatController,
  type ChatRenderIcon,
  type ChatServices,
} from '~/components/chat';
import { ChatInput } from '~/components/chat/ChatInput';
import { useTTS } from '~/components/media/use-tts';
import { useThemeColors } from '~/components/theme/theme';
import { EmptyState } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import {
  DEFAULT_CHAT_TITLE,
  resolveChatScreenTitle,
  updateChatTitleCaches,
  useActiveChat,
  useArchiveChat,
  useChatMessages,
  useSendMessage,
} from '~/services/chat';
import type { ChatWithActivity } from '~/services/chat/session-types';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import {
  createChatInboxRefreshSnapshot,
  upsertInboxSessionActivity,
} from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';

const renderChatIcon: ChatRenderIcon = (name, props) => (
  <View style={props.style}>
    <AppIcon name={name as any} size={props.size} color={props.color} />
  </View>
);

export default function ChatDetailScreen() {
  const { id, initialMessage } = useLocalSearchParams<{ id: string; initialMessage?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const client = useApiClient();
  const themeColors = useThemeColors();
  const queryClient = useQueryClient();
  const [composerClearance, setComposerClearance] = useState(0);
  const { speakingId, speak } = useTTS();
  const { data: activeChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;

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
      },
      chatKeys: {
        messages: chatKeys.messages,
      },
      speech: {
        speak: (messageId: string, text: string) => {
          void speak(messageId, text);
        },
        speakingId,
      },
    }),
    [chatId, queryClient, speak, speakingId],
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
      router.replace('/(protected)/(tabs)');
    },
    services,
    source,
  });

  const displayTitle = resolveChatScreenTitle(activeChat?.title, controller.resolvedSource);

  const createChatMutation = useMutation({
    mutationFn: async () => {
      const res = await client.api.chats.$post({ json: { title: DEFAULT_CHAT_TITLE } });
      return res.json();
    },
    onSuccess: (chat) => {
      queryClient.setQueryData(chatKeys.activeChat(chat.id), chat);
      queryClient.setQueryData<ChatWithActivity[] | undefined>(
        chatKeys.resumableSessions,
        (sessions) =>
          upsertInboxSessionActivity(
            sessions ?? [],
            createChatInboxRefreshSnapshot({
              chatId: chat.id,
              noteId: chat.noteId,
              timestamp: chat.updatedAt,
              title: chat.title,
              userId: chat.userId,
            }),
          ),
      );
      router.push(`/(protected)/(tabs)/chat/${chat.id}`);
    },
  });

  const isCreatingChat = createChatMutation.isPending;
  const handleCreateChat = createChatMutation.mutate;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: displayTitle,
      headerTitleAlign: 'center',
      headerRight: () => (
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="Conversation actions"
            hitSlop={10}
            onPress={controller.handleOpenMenu}
            style={styles.headerButton}
          >
            <Image
              source="sf:ellipsis"
              style={styles.headerIcon}
              tintColor={themeColors.foreground}
              contentFit="contain"
            />
          </Pressable>
          <Pressable
            accessibilityLabel="New chat"
            hitSlop={10}
            onPress={() => {
              if (!isCreatingChat) {
                handleCreateChat();
              }
            }}
            style={styles.headerButton}
          >
            <Image
              source="sf:square.and.pencil"
              style={styles.headerIcon}
              tintColor={themeColors.foreground}
              contentFit="contain"
            />
          </Pressable>
        </View>
      ),
    });
  }, [
    controller.handleOpenMenu,
    displayTitle,
    handleCreateChat,
    isCreatingChat,
    navigation,
    themeColors.foreground,
  ]);

  const emptyState = useMemo(
    () => (
      <EmptyState
        sfSymbol="bubble.left"
        title="Start the conversation"
        description="Ask a question, attach a photo, or record a voice note."
        bottomOffset={composerClearance}
      />
    ),
    [composerClearance],
  );

  return (
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
        speakingId={controller.speakingId}
        chatSendStatus={controller.chatSendStatus as 'idle' | 'submitted' | 'streaming' | 'error'}
        onCopy={controller.handleCopyMessage}
        onEdit={controller.handleEditMessage}
        onRegenerate={controller.handleRegenerate}
        onDelete={controller.handleDeleteMessage}
        onSpeak={controller.handleSpeakMessage}
        onShare={(message: Parameters<typeof controller.handleShareMessage>[0]) => {
          void controller.handleShareMessage(message);
        }}
        renderIcon={renderChatIcon}
        formatTimestamp={formatRelativeAge}
        contentPaddingBottom={composerClearance}
        emptyState={emptyState}
      />
      <ConversationActionsSheet
        canTransform={controller.canTransform}
        isArchiving={controller.isArchiving}
        onArchive={controller.handleArchiveChat}
        onClose={controller.handleCloseMenu}
        onOpenSearch={controller.handleOpenSearch}
        onToggleDebug={controller.handleToggleDebug}
        onTransform={controller.handleTransformFromMenu}
        transformTypes={controller.enabledTransforms}
        showDebug={controller.showDebug}
        statusCopy={controller.statusCopy}
        title="Conversation"
        visible={controller.showActionsMenu}
      />
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
      <ChatInput
        chatId={chatId}
        initialMessage={initialMessage}
        onClearanceChange={setComposerClearance}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
    width: 36,
  },
  headerIcon: {
    height: 18,
    width: 18,
  },
});
