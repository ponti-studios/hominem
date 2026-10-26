import type { ChatMessageItem } from '@hominem/chat';
import { memo } from 'react';
import Animated from 'react-native-reanimated';

import { useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionAnimations } from '~/services/motion/native-motion';

import { ActiveMessageActions } from './chat-message-actions';
import { ChatMessageBubble } from './chat-message-bubble';
import { MessageReasoning } from './chat-message-reasoning';
import { MessageToolCalls } from './chat-message-tool-calls';
import { createChatMessageStyles } from './chat-message.styles';

type ChatMessageProps = {
  message: ChatMessageItem;
  showDebug?: boolean;
  // Requests that the parent list open its single shared edit modal for this
  // message -- editing state (draft text, which message is being edited)
  // lives once at the list level instead of duplicated per row, since at
  // most one row is ever being edited at a time. See ChatMessageList.
  onRequestEdit?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  activity?: 'active' | 'idle';
  onActivate?: (messageId: string) => void;
  formatTimestamp: (value: string) => string;
  // True only for a row just added this session (a freshly sent user
  // message), not a historical row that was already there when the screen
  // or a page of history loaded. Gates the entrance animation so opening a
  // chat doesn't replay it for every existing message.
  entrance?: 'new-message' | 'none';
  // True only for the render where this message's `failed` flag just
  // flipped from false to true (a live retry failure or stream
  // interruption), not a historical failure that was already there when
  // this row loaded or recycled into view. Computed by the parent list from
  // message-id-keyed state, not derived locally here -- FlashList recycles
  // this component across different messages, so this component's own
  // mount timing doesn't correspond to any one message's lifetime.
  failure?: 'new' | 'none';
};

export const ChatMessage = memo(function ChatMessage({
  message,
  showDebug = false,
  onRequestEdit,
  onRegenerate,
  onDelete,
  onRetry,
  activity = 'idle',
  onActivate,
  formatTimestamp,
  entrance = 'none',
  failure = 'none',
}: ChatMessageProps) {
  const styles = useStyles(createChatMessageStyles);

  const { role, isStreaming, failed } = message;
  const isUser = role.toLowerCase() === 'user';
  const reducedMotion = useReducedMotion();
  // A just-sent user message lifts and fades in; historical rows (chat open,
  // pagination) just mount with no entrance animation.
  const rowEntering =
    isUser && entrance === 'new-message'
      ? reducedMotion
        ? nativeMotionAnimations.fadeInQuick
        : nativeMotionAnimations.fadeInDownQuick
      : undefined;
  const timestamp = message.createdAt ? formatTimestamp(message.createdAt) : '';
  const actions = {
    canRegenerate: !isUser && !isStreaming && !failed && onRegenerate !== undefined,
    canEdit: isUser && !isStreaming && onRequestEdit !== undefined,
    canDelete: !isStreaming && onDelete !== undefined,
  };
  const renderedToolCalls = message.toolCalls ?? [];
  // A tool- or reasoning-only turn has no words yet: the cards stand alone instead of
  // trailing an empty bubble.
  const hasBubble = isUser || isStreaming || failed || Boolean(message.message.trim());

  return (
    <Animated.View
      entering={rowEntering}
      style={[styles.message, isUser ? styles.messageUser : styles.messageAssistant]}
    >
      <MessageReasoning message={message} />
      <MessageToolCalls toolCalls={renderedToolCalls} />
      {hasBubble ? (
        <ChatMessageBubble
          isNewlyFailed={failure === 'new'}
          isUser={isUser}
          message={message}
          styles={styles}
          onActivate={onActivate}
          onRetry={onRetry}
          reducedMotion={reducedMotion}
          showDebug={showDebug}
        />
      ) : null}
      <ActiveMessageActions
        actions={actions}
        isActive={activity === 'active'}
        isUser={isUser}
        message={message}
        onDelete={onDelete}
        onEdit={() => onRequestEdit?.(message.id)}
        onRegenerate={onRegenerate}
        timestamp={timestamp}
      />
    </Animated.View>
  );
});
