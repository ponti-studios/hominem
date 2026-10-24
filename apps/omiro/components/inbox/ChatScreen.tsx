import { deriveSessionSource } from '@hominem/chat/ui';
import { isObject } from '@hominem/utils';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { getToolCallPhase } from '~/components/chat';
import { useChatActionsMenu } from '~/components/chat/chat-actions-menu';
import { ChatSettingsSheet } from '~/components/chat/chat-settings-sheet';
import { ChatSourcesSheet } from '~/components/chat/chat-sources-sheet';
import { useComposerDockMetrics } from '~/components/composer/ComposerDock';
import { getDockKeyboardOffset } from '~/components/composer/composerDock.helpers';
import { ChatScreenDock } from '~/components/inbox/ChatScreenDock';
import { ChatScreenMessageList } from '~/components/inbox/ChatScreenMessageList';
import {
  FloatingActionPill,
  FloatingCircleButton,
  FloatingHeader,
  useFloatingHeaderHeight,
  FloatingPillButton,
} from '~/components/navigation/floating-header';
import { useStyles } from '~/components/theme';
import { ActionMenu } from '~/components/ui/action-menu';
import { useChatData } from '~/hooks/use-chat-data';
import { useChatSearch } from '~/hooks/use-chat-search';
import { useNetworkStatus } from '~/hooks/use-network-status';
import { getChatTitle, useActiveChat, useEditChatMessage } from '~/services/chat';
import { useChatScreenGeneration } from '~/services/chat/use-chat-screen-generation';
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

export function ChatScreen({ id }: { id: string }) {
  const router = useRouter();
  const { data: activeChat, error: activeChatError } = useActiveChat(id);
  const chatId = activeChat?.id ?? id;
  const { inset: composerInset, restingInset } = useComposerDockMetrics();
  const headerHeight = useFloatingHeaderHeight();
  const [showDebug, setShowDebug] = useState(false);
  const { isOnline } = useNetworkStatus();
  const styles = useStyles((theme) => ({
    container: { flex: 1 },
    offlineIndicator: {
      marginTop: headerHeight,
      backgroundColor: theme.colors.muted,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    offlineText: {
      ...theme.textVariants.footnote,
      textAlign: 'center',
      color: theme.colors.mutedForeground,
    },
  }));

  const chatGeneration = useChatScreenGeneration(chatId);

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
    retryActiveGeneration,
    regenerateMessage,
    respondToolCall,
    isRespondingToToolCall,
  } = chatGeneration;
  const chatSend = useMemo(
    () => ({ sendChatMessage, isChatSending }),
    [sendChatMessage, isChatSending],
  );
  const editMessage = useEditChatMessage(chatId);
  const handleEditMessage = useCallback(
    (messageId: string, content: string) => {
      void editMessage.mutateAsync({ messageId, content });
    },
    [editMessage],
  );

  const activeGeneration = generation;
  const cancelActiveGeneration = cancelGeneration;
  const dismissActiveGeneration = dismissGeneration;
  // The assistant is waiting on a yes/no for a tool call: that decision takes
  // over the composer until it is answered.
  const pendingToolCall = messages
    .flatMap((message) =>
      (message.toolCalls ?? []).map((toolCall) => ({ messageId: message.id, toolCall })),
    )
    .find(({ toolCall }) => getToolCallPhase(toolCall) === 'asking');
  const respondToToolCall = async (approved: boolean) => {
    if (!pendingToolCall) {
      return;
    }
    await respondToolCall({
      messageId: pendingToolCall.messageId,
      toolCallId: pendingToolCall.toolCall.toolCallId,
      approved,
    });
  };
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

  // A chat still on the default title is named from its first user message.
  const derivedSource = useMemo(
    () =>
      deriveSessionSource({
        messages: messages.map((message) => ({ role: message.role, content: message.message })),
      }),
    [messages],
  );
  const displayTitle = getChatTitle(activeChat?.title, derivedSource);

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

  return (
    <>
      <FloatingHeader
        overlay
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
        <ChatScreenMessageList
          status={{
            phase: isMessagesLoading ? 'loading' : isMessagesRefreshing ? 'refreshing' : 'ready',
            error: isConversationGone ? 'missing' : messagesError ? 'load' : null,
          }}
          refetchMessages={refetchMessages}
          onGoBack={() => router.dismissTo(CHAT_ROUTE)}
          search={search}
          showDebug={showDebug}
          onEdit={handleEditMessage}
          onRegenerate={regenerateMessage}
          onRetry={retryFailedMessage}
          generation={activeGeneration}
          bottomInset={composerInset}
          keyboardOffset={getDockKeyboardOffset(restingInset)}
          topInset={headerHeight}
        />
        <ChatScreenDock
          chatId={chatId}
          restingInset={restingInset}
          isConversationGone={isConversationGone}
          pendingToolCall={pendingToolCall}
          isRespondingToToolCall={isRespondingToToolCall}
          onRespondToToolCall={(approved) => {
            void respondToToolCall(approved);
          }}
          generation={activeGeneration}
          failedMessageText={failedMessageText}
          onEditFailedMessage={editFailedMessage}
          onCancelGeneration={() => {
            void cancelActiveGeneration();
          }}
          onRetryGeneration={retryActiveGeneration}
          search={search}
          chatSend={chatSend}
        />
      </View>
    </>
  );
}
