import type { SessionSource } from '@hominem/rpc/types';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router/build/hooks';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChatMessageList,
  ChatReviewOverlay,
  ChatSearchModal,
  ConversationMenu,
  useChatController,
  type ChatRenderIcon,
  type ChatServices,
} from '~/components/chat';
import { ChatComposer } from '~/components/chat/ChatComposer';
import { useTTS } from '~/components/media/use-tts';
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
import { useCreateChat } from '~/services/chat/use-create-chat';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import { chatKeys } from '~/services/notes/query-keys';
import t from '~/translations';

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
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { speakingId, speak } = useTTS();
  const { data: activeChat } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const [composerHeight, setComposerHeight] = useState(0);

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

  const { mutate: handleCreateChat, isPending: isCreatingChat } = useCreateChat();

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
            onPress={() => handleCreateChat({ title: DEFAULT_CHAT_TITLE })}
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
        contentPaddingBottom={composerHeight + insets.bottom}
        emptyState={emptyState}
      />
      <KeyboardStickyView
        offset={{ closed: 0, opened: 0 }}
        pointerEvents="box-none"
        style={styles.composerOverlay}
      >
        <View onLayout={handleComposerLayout}>
          <ChatComposer chatId={chatId} initialMessage={initialMessage} />
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
