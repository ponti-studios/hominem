import { useApiClient } from '@hominem/rpc/react';
import type { SessionSource } from '@hominem/rpc/types';
import { useNavigation } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router/build/hooks';
import React, { useLayoutEffect, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import {
  ChatMessageList,
  ChatReviewOverlay,
  ChatSearchModal,
  ConversationMenu,
  useChatController,
  type ChatRenderIcon,
  type ChatServices,
} from '~/components/chat';
import { ChatInput } from '~/components/chat/ChatInput';
import { useTTS } from '~/components/media/use-tts';
import { useThemeColors } from '~/components/theme';
import { EmptyState } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';
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

const renderChatIcon: ChatRenderIcon = (name, props) => {
  const tintColor = props.color;
  return (
    <View style={props.style}>
      <AppIcon name={name} size={props.size} tintColor={tintColor} />
    </View>
  );
};

export default function ChatDetailScreen() {
  const { id, initialMessage } = useLocalSearchParams<{ id: string; initialMessage?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const themeColors = useThemeColors();
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
          <ConversationMenu
            canTransform={controller.canTransform}
            isArchiving={controller.isArchiving}
            onArchive={controller.handleArchiveChat}
            onOpenSearch={controller.handleOpenSearch}
            onToggleDebug={controller.handleToggleDebug}
            onTransform={controller.handleTransformFromMenu}
            showDebug={controller.showDebug}
          />
          <Pressable
            disabled={isCreatingChat}
            hitSlop={6}
            onPress={() => handleCreateChat()}
            style={({ pressed }) => [
              styles.headerIconButton,
              { opacity: isCreatingChat ? 0.35 : pressed ? 0.65 : 1 },
            ]}
          >
            <AppIcon name="square.and.pencil" />
          </Pressable>
        </View>
      ),
    });
  }, [
    controller.canTransform,
    controller.handleArchiveChat,
    controller.handleOpenSearch,
    controller.handleToggleDebug,
    controller.handleTransformFromMenu,
    controller.isArchiving,
    controller.showDebug,
    displayTitle,
    handleCreateChat,
    isCreatingChat,
    navigation,
    themeColors,
  ]);

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
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
        emptyState={emptyState}
      />
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
      <ChatInput chatId={chatId} initialMessage={initialMessage} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  reviewOverlay: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    pointerEvents: 'box-none',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    width: 88,
  },
  headerIconButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
});
