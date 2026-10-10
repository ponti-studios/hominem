import type { SessionSource } from '@hominem/rpc/types';
import { isObject } from '@hominem/utils';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';

import {
  ChatGenerationBar,
  ChatMessageList,
  ChatSearchBar,
  ChatToolApprovalBar,
  getToolCallPhase,
} from '~/components/chat';
import { useChatActionsMenu } from '~/components/chat/chat-actions-menu';
import { ChatSettingsSheet } from '~/components/chat/chat-settings-sheet';
import { ChatSourcesSheet } from '~/components/chat/chat-sources-sheet';
import { Composer } from '~/components/composer/Composer';
import { ComposerDock, useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { getDockKeyboardOffset } from '~/components/composer/composerDock.helpers';
import {
  FloatingActionPill,
  FloatingCircleButton,
  FloatingHeader,
  FloatingPillButton,
} from '~/components/navigation/floating-header';
import { useStyles } from '~/components/theme';
import { EmptyState } from '~/components/ui';
import { ActionMenu } from '~/components/ui/action-menu';
import { useChatData } from '~/hooks/use-chat-data';
import { useChatSearch } from '~/hooks/use-chat-search';
import { useNetworkStatus } from '~/hooks/use-network-status';
import {
  getChatTitle,
  useActiveChat,
  useEditChatMessage,
  useRegenerateMessage,
  useSendMessage,
  useToolCallRespond,
} from '~/services/chat';
import { formatRelativeAge } from '~/services/date/format-relative-age';
import {
  clearResumeTarget,
  writeChatDraft,
  writeResumeTarget,
} from '~/services/navigation/launch-state';
import { NEW_CHAT_ROUTE, CHAT_ROUTE } from '~/services/navigation/routes';
import t from '~/translations';

function isNotFoundError(error: unknown): boolean {
  return isObject(error) && 'status' in error && error.status === 404;
}

const NEW_SESSION_SOURCE: SessionSource = { kind: 'new' };

export function ChatScreen({ id }: { id: string }) {
  const router = useRouter();
  const { data: activeChat, error: activeChatError } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const { inset: composerInset, restingInset } = useComposerDockMetrics();
  const [showDebug, setShowDebug] = useState(false);
  const { isOnline } = useNetworkStatus();
  const styles = useStyles((theme) => ({
    container: { flex: 1 },
    offlineIndicator: {
      backgroundColor: theme.colors.muted,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    offlineText: {
      ...theme.textVariants.footnote,
      textAlign: 'center',
    },
  }));

  const handleChatArchive = useCallback(() => {
    router.dismissTo(CHAT_ROUTE);
  }, [router]);

  const { messages, messagesError, isMessagesLoading, isMessagesRefreshing, refetchMessages } =
    useChatData({ chatId });
  const isConversationGone = isNotFoundError(activeChatError) || isNotFoundError(messagesError);
  const search = useChatSearch(messages, chatId);
  const handleToggleDebug = useCallback(() => setShowDebug((value) => !value), []);
  // Owned here rather than inside Composer, so the composer's send and the
  // message list's retry action share one mutation instead of racing two
  // separate streams.
  const {
    cancelGeneration,
    dismissGeneration,
    generation,
    sendChatMessage,
    isChatSending,
    retryFailedMessage,
    retryLastGeneration,
  } = useSendMessage({ chatId });
  const chatSend = useMemo(
    () => ({ sendChatMessage, isChatSending }),
    [sendChatMessage, isChatSending],
  );
  const toolCallRespond = useToolCallRespond({ chatId });
  const editMessage = useEditChatMessage(chatId);
  const handleEditMessage = useCallback(
    (messageId: string, content: string) => {
      void editMessage.mutateAsync({ messageId, content });
    },
    [editMessage],
  );

  const {
    cancelGeneration: cancelRegeneration,
    dismissGeneration: dismissRegeneration,
    generation: regeneration,
    regenerateMessage,
    retryGeneration,
  } = useRegenerateMessage(chatId);
  const activeGeneration = generation ?? regeneration;
  const cancelActiveGeneration = generation ? cancelGeneration : cancelRegeneration;
  const retryActiveGeneration = generation ? retryLastGeneration : retryGeneration;
  const dismissActiveGeneration = generation ? dismissGeneration : dismissRegeneration;
  // The approval's continuation streams through its own client, so once it
  // finishes the paused generation that was waiting on it is done too.
  const respondToToolCall = async (approved: boolean) => {
    if (!pendingToolCall) {
      return;
    }
    try {
      await toolCallRespond.respond({
        messageId: pendingToolCall.messageId,
        toolCallId: pendingToolCall.toolCall.toolCallId,
        approved,
      });
    } finally {
      dismissGeneration();
      dismissRegeneration();
    }
  };
  // The assistant is waiting on a yes/no for a tool call: that decision takes
  // over the composer until it is answered.
  const pendingToolCall = messages
    .flatMap((message) =>
      (message.toolCalls ?? []).map((toolCall) => ({ messageId: message.id, toolCall })),
    )
    .find(({ toolCall }) => getToolCallPhase(toolCall) === 'asking');
  const failedMessageText =
    activeGeneration?.stage === 'failed' && activeGeneration.userMessageId
      ? messages.find((message) => message.id === activeGeneration.userMessageId)?.message
      : undefined;
  // Hands the failed message back to the composer: it reopens with the text
  // restored, ready to edit and send again.
  const editFailedMessage = useCallback(() => {
    if (failedMessageText) {
      writeChatDraft(chatId, failedMessageText);
    }
    dismissActiveGeneration();
  }, [chatId, dismissActiveGeneration, failedMessageText]);

  const displayTitle = getChatTitle(activeChat?.title, NEW_SESSION_SOURCE);

  useEffect(() => {
    writeResumeTarget({
      kind: 'chat',
      id: chatId,
      title: displayTitle,
      updatedAt: activeChat?.updatedAt ?? null,
    });
  }, [activeChat?.updatedAt, chatId, displayTitle]);

  useEffect(() => {
    return () => {
      clearResumeTarget();
    };
  }, []);

  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showChatSources, setShowChatSources] = useState(false);

  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();

  const chatMenuSections = useChatActionsMenu({
    chatId,
    canTransform: messages.length > 0,
    isConversationGone,
    messages,
    onChatArchive: handleChatArchive,
    onOpenSearch: search.handleOpenSearch,
    onOpenSettings: () => setShowChatSettings(true),
    onOpenSources: () => setShowChatSources(true),
    onToggleDebug: handleToggleDebug,
    showDebug,
  });

  const emptyState = (
    <EmptyState
      description={t.chat.emptyState.description}
      sfSymbol="bubble.left"
      title={t.chat.emptyState.title}
    />
  );
  const errorState = (
    <EmptyState
      action={{
        label: t.chat.loadErrorRetry,
        onPress: () => {
          void refetchMessages();
        },
      }}
      sfSymbol="arrow.clockwise.circle"
      title={t.chat.loadErrorTitle}
    />
  );
  const missingConversationState = (
    <EmptyState
      action={{ label: t.chat.goBack, onPress: () => router.dismissTo(CHAT_ROUTE) }}
      description={t.chat.missingMessage}
      sfSymbol="bubble.left.and.exclamationmark.bubble.right"
      title={t.chat.missingTitle}
    />
  );

  return (
    <>
      <FloatingHeader
        left=<FloatingCircleButton
          accessibilityLabel="BackButton"
          icon={canGoBack ? 'chevron.left' : 'xmark'}
          onPress={() => (canGoBack ? router.back() : router.dismissTo(CHAT_ROUTE))}
          testID="chat-back-button"
        />
        right={
          <FloatingActionPill>
            <FloatingPillButton
              accessibilityLabel={t.chat.conversationActionsLabel}
              icon="ellipsis.circle"
              onPress={() => setShowActionsMenu(true)}
              testID="chat-actions-button"
            />
            <FloatingPillButton
              accessibilityLabel="New chat"
              icon="square.and.pencil"
              onPress={() => router.push(NEW_CHAT_ROUTE)}
              testID="chat-new-button"
            />
          </FloatingActionPill>
        }
      />
      <ActionMenu
        onClose={() => setShowActionsMenu(false)}
        sections={chatMenuSections}
        testID="chat-actions-menu"
        visible={showActionsMenu}
      />

      <View style={styles.container}>
        <ChatSettingsSheet visible={showChatSettings} onClose={() => setShowChatSettings(false)} />
        <ChatSourcesSheet
          chatId={chatId}
          visible={showChatSources}
          onClose={() => setShowChatSources(false)}
        />
        {!isOnline ? (
          <View
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={styles.offlineIndicator}
            testID="chat-offline-indicator"
          >
            <Text style={styles.offlineText}>{t.chat.offlineIndicator}</Text>
          </View>
        ) : null}
        <ChatMessageList
          bottomInset={composerInset}
          keyboardOffset={getDockKeyboardOffset(restingInset)}
          isMessagesLoading={isMessagesLoading}
          displayMessages={search.displayMessages}
          showSearch={search.showSearch}
          searchQuery={search.searchQuery}
          showDebug={showDebug}
          onEdit={handleEditMessage}
          onRegenerate={regenerateMessage}
          onRetry={retryFailedMessage}
          generation={activeGeneration}
          formatTimestamp={formatRelativeAge}
          emptyState={
            isConversationGone ? missingConversationState : messagesError ? errorState : emptyState
          }
          refreshControl=<RefreshControl
            refreshing={isMessagesRefreshing}
            onRefresh={() => {
              void refetchMessages();
            }}
          />
        />
        {!isConversationGone ? (
          <>
            <ComposerDock restingInset={restingInset} testID="chat-composer-dock">
              {/* While a reply generates the composer flattens to one line
                  (the bar), then springs back when it ends. */}
              {pendingToolCall ? (
                <ChatToolApprovalBar
                  disabled={toolCallRespond.isResponding}
                  onApprove={() => {
                    void respondToToolCall(true);
                  }}
                  onReject={() => {
                    void respondToToolCall(false);
                  }}
                  toolName={pendingToolCall.toolCall.toolName}
                />
              ) : activeGeneration ? (
                <ChatGenerationBar
                  generation={activeGeneration}
                  onCancel={() => {
                    void cancelActiveGeneration();
                  }}
                  onEdit={failedMessageText ? editFailedMessage : undefined}
                  onRetry={retryActiveGeneration}
                />
              ) : search.showSearch ? (
                <ChatSearchBar
                  inputRef={search.searchInputRef}
                  onChangeQuery={search.handleSearchQueryChange}
                  onClose={search.handleCloseSearch}
                  query={search.searchQuery}
                  resultCount={search.displayMessages.length}
                />
              ) : (
                <Composer mode="chat" chatId={chatId} chatSend={chatSend} />
              )}
            </ComposerDock>
          </>
        ) : null}
      </View>
    </>
  );
}
