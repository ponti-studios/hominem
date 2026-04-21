import { useApiClient } from '@hakumi/rpc/react';
import type { SessionSource } from '@hakumi/rpc/types';
import {
  ChatMessageList,
  ChatReviewOverlay,
  ChatSearchModal,
  ConversationActionsSheet,
  type ChatRenderIcon,
  type ChatServices,
  useChatController,
} from '~/components/chat';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { DEFAULT_CHAT_TITLE, resolveChatScreenTitle, updateChatTitleCaches , useActiveChat, useArchiveChat, useChatMessages, useSendMessage } from '~/services/chat';
import { useTTS } from '~/components/media/use-tts';
import { theme } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { EmptyState } from '~/components/ui';
import {
  createChatInboxRefreshSnapshot,
  upsertInboxSessionActivity,
} from '~/services/inbox/inbox-refresh';
import { chatKeys } from '~/services/notes/query-keys';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import type { ChatWithActivity } from '~/services/chat/session-state';

const renderChatIcon: ChatRenderIcon = (name, props) => (
  <View style={props.style}>
    <AppIcon name={name as any} size={props.size} color={props.color} />
  </View>
);

export default function ChatDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { composerClearance } = useComposerContext();
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
      router.replace('/(protected)/(tabs)' as RelativePathString);
    },
    services,
    source,
  });

  const displayTitle = resolveChatScreenTitle(activeChat?.title, controller.resolvedSource);

  const createChatMutation = useMutation({
    mutationFn: async () => client.chats.create({ title: DEFAULT_CHAT_TITLE }),
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
      router.push(`/(protected)/(tabs)/chat/${chat.id}` as RelativePathString);
    },
  });

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
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: displayTitle,
          headerTitleAlign: 'center',
          headerRight: () => (
            <View style={styles.headerActions}>
              <Pressable
                onPress={controller.handleOpenMenu}
                hitSlop={8}
                accessibilityLabel="Conversation actions"
                style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
              >
                <AppIcon color={theme.colors.foreground} name="ellipsis" size={20} />
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!createChatMutation.isPending) {
                    createChatMutation.mutate();
                  }
                }}
                hitSlop={8}
                accessibilityLabel="New chat"
                style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
              >
                <AppIcon color={theme.colors.foreground} name="square.and.pencil" size={20} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ChatSearchModal
        visible={controller.showSearch}
        searchQuery={controller.searchQuery}
        resultCount={controller.displayMessages.length}
        searchInputRef={controller.searchInputRef}
        onClose={controller.handleCloseSearch}
        onChangeSearchQuery={controller.handleSearchQueryChange}
        renderIcon={renderChatIcon}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  headerButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  headerButtonPressed: {
    opacity: 0.5,
  },
});
