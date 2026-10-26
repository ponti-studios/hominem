import type { ChatMessageItem } from '@hominem/chat';
import { useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';

// A bubble keeps one key from first paint to final message, so that is its identity here.
const identityOf = (message: ChatMessageItem) => message.renderKey ?? message.id;

function announceMessage(message: ChatMessageItem, previous?: ChatMessageItem) {
  const failed = Boolean(message.failed || message.error);
  const wasFailed = Boolean(previous?.failed || previous?.error);

  if (failed && !wasFailed) {
    AccessibilityInfo.announceForAccessibility('Message failed to send. Tap retry.');
    return;
  }

  if (!previous) {
    if (message.role === 'user') {
      AccessibilityInfo.announceForAccessibility('Message sent.');
    } else if (message.isStreaming) {
      AccessibilityInfo.announceForAccessibility('Assistant is responding.');
    } else {
      AccessibilityInfo.announceForAccessibility('New assistant message.');
    }
    return;
  }

  if (previous.isStreaming && !message.isStreaming && !failed) {
    AccessibilityInfo.announceForAccessibility('Assistant reply complete.');
  }
}

export function useChatMessageListLifecycle({
  displayMessages,
  renderedMessages,
  isMessagesLoading,
  showSearch,
  hasSearchQuery,
  onNewUserMessage,
}: {
  displayMessages: ChatMessageItem[];
  renderedMessages: ChatMessageItem[];
  isMessagesLoading: boolean;
  showSearch: boolean;
  hasSearchQuery: boolean;
  // Fired once when the reader sends a message, with that message's identity key.
  onNewUserMessage: (key: string) => void;
}) {
  const prevCountRef = useRef(renderedMessages.length);
  const prevLastMessageIdRef = useRef(
    renderedMessages.at(-1)?.renderKey ?? renderedMessages.at(-1)?.id ?? null,
  );
  const announcedMessagesRef = useRef(new Map<string, ChatMessageItem>());
  const didInitializeAnnouncementsRef = useRef(false);

  useEffect(() => {
    const previousMessages = announcedMessagesRef.current;
    if (
      !didInitializeAnnouncementsRef.current &&
      isMessagesLoading &&
      displayMessages.length === 0
    ) {
      return;
    }
    if (hasSearchQuery) {
      return;
    }

    if (!didInitializeAnnouncementsRef.current) {
      for (const message of renderedMessages) {
        previousMessages.set(identityOf(message), message);
      }
      didInitializeAnnouncementsRef.current = true;
      return;
    }

    for (const message of renderedMessages) {
      const previous = previousMessages.get(identityOf(message));
      announceMessage(message, previous);
      previousMessages.set(identityOf(message), message);
    }
    const renderedIds = new Set(renderedMessages.map(identityOf));
    for (const id of previousMessages.keys()) {
      if (!renderedIds.has(id)) {
        previousMessages.delete(id);
      }
    }
  }, [displayMessages.length, hasSearchQuery, isMessagesLoading, renderedMessages]);

  useEffect(() => {
    const lastMessage = renderedMessages.at(-1) ?? null;
    const countChanged = renderedMessages.length !== prevCountRef.current;
    const lastMessageIdChanged =
      (lastMessage ? identityOf(lastMessage) : null) !== prevLastMessageIdRef.current;
    const shouldScrollForNewUserMessage =
      countChanged && lastMessageIdChanged && lastMessage?.role === 'user';

    prevCountRef.current = renderedMessages.length;
    prevLastMessageIdRef.current = lastMessage ? identityOf(lastMessage) : null;

    if (showSearch || isMessagesLoading || !shouldScrollForNewUserMessage || !lastMessage) {
      return;
    }

    onNewUserMessage(identityOf(lastMessage));
  }, [isMessagesLoading, onNewUserMessage, renderedMessages, showSearch]);

  return { announcedMessagesRef, didInitializeAnnouncementsRef };
}
