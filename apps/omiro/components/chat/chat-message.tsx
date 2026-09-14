import type { ChatMessageItem } from '@hominem/chat';
import { memo, useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionAnimations } from '~/services/motion/native-motion';
import t from '~/translations';

import { ActiveMessageActions } from './chat-message-actions';
import { MessageContent } from './chat-message-content';
import { MessageDebug } from './chat-message-debug';
import { MessageToolCalls } from './chat-message-tool-calls';
import { ChatThinkingIndicator } from './chat-thinking-indicator';

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
  onToolCallRespond?: (input: { messageId: string; toolCallId: string; approved: boolean }) => void;
  isRespondingToToolCall?: boolean;
  isActive?: boolean;
  onActivate?: (messageId: string) => void;
  formatTimestamp: (value: string) => string;
  // True only for a row just added this session (a freshly sent user
  // message), not a historical row that was already there when the screen
  // or a page of history loaded. Gates the entrance animation so opening a
  // chat doesn't replay it for every existing message.
  isNewMessage?: boolean;
  // True only for the render where this message's `failed` flag just
  // flipped from false to true (a live retry failure or stream
  // interruption), not a historical failure that was already there when
  // this row loaded or recycled into view. Computed by the parent list from
  // message-id-keyed state, not derived locally here -- FlashList recycles
  // this component across different messages, so this component's own
  // mount timing doesn't correspond to any one message's lifetime.
  isNewlyFailed?: boolean;
};

export const ChatMessage = memo(function ChatMessage({
  message,
  showDebug = false,
  onRequestEdit,
  onRegenerate,
  onDelete,
  onRetry,
  onToolCallRespond,
  isRespondingToToolCall,
  isActive = false,
  onActivate,
  formatTimestamp,
  isNewMessage = false,
  isNewlyFailed = false,
}: ChatMessageProps) {
  const {
    foreground: textPrimary,
    primaryForeground,
    destructive,
    tertiary,
  } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    content: { gap: 8, width: '100%' },
    reasoningPanel: {
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: 6,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 12,
      width: '100%',
    },
    reasoningText: { ...theme.textVariants.mono, color: theme.colors.foreground, opacity: 0.8 },
    retryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
    interruptedRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    message: { width: '100%' },
    messageUser: { alignItems: 'flex-end' },
    messageAssistant: { alignItems: 'flex-start' },
    userBubble: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.borderRadii.sm,
      borderBottomRightRadius: 2,
      paddingHorizontal: 12,
    },
    assistantBubble: {
      borderRadius: theme.borderRadii.sm,
      borderBottomLeftRadius: 2,
      paddingHorizontal: 12,
    },
    continuous: { borderCurve: 'continuous' },
  }));

  const { role, message: content, isStreaming, failed } = message;
  const isUser = role.toLowerCase() === 'user';
  const handleActivate = useCallback(() => onActivate?.(message.id), [onActivate, message.id]);
  const reducedMotion = useReducedMotion();
  // A just-sent user message lifts and fades in; historical rows (chat open,
  // pagination) just mount with no entrance animation.
  const rowEntering =
    isUser && isNewMessage
      ? reducedMotion
        ? nativeMotionAnimations.fadeInQuick
        : nativeMotionAnimations.fadeInDownQuick
      : undefined;
  // Lets the message's height settle smoothly when the typing indicator
  // goes away, Markdown reflows, or a failure/retry banner shows or clears
  // -- no-op for rows whose height never changes. Applied to the inner
  // content View, not this row's own root: FlashList recycles and
  // repositions row roots as you scroll, and a layout animation on the row
  // root animates *that* reposition too, so a recycled row's text visibly
  // slides in from its previous occupant's position (ghosting) instead of
  // just appearing. Scoping it to the subtree that actually reflows avoids
  // that while keeping the smooth height transition.
  const contentLayout = reducedMotion ? undefined : nativeMotionAnimations.layoutQuick;
  // Only animate the retry/interrupted banner in when the failure is new
  // this session (see isNewlyFailed prop doc) -- a historical failure just
  // appears static instead of replaying its entrance every time the row
  // loads or gets recycled into view.
  const bannerEntering = isNewlyFailed
    ? reducedMotion
      ? nativeMotionAnimations.fadeInQuick
      : nativeMotionAnimations.fadeInDownQuick
    : undefined;
  const bannerExiting = reducedMotion
    ? nativeMotionAnimations.fadeOutQuick
    : nativeMotionAnimations.fadeOutUpQuick;

  const timestamp = message.createdAt ? formatTimestamp(message.createdAt) : '';
  const canRegenerate = !isUser && !isStreaming && !failed && onRegenerate !== undefined;
  const canEdit = isUser && !isStreaming && onRequestEdit !== undefined;
  const canDelete = !isStreaming && onDelete !== undefined;
  const hasReasoning = Boolean(message.reasoning && message.reasoning.trim().length > 0);
  const renderedToolCalls = message.toolCalls ?? [];

  const textStyle = useMemo(
    () => ({
      color: isUser ? primaryForeground : textPrimary,
      fontSize: 16,
      lineHeight: isUser ? 24 : 25.6,
    }),
    [isUser, primaryForeground, textPrimary],
  );

  return (
    <Animated.View
      entering={rowEntering}
      style={[styles.message, isUser ? styles.messageUser : styles.messageAssistant]}
    >
      <MessageToolCalls
        messageId={message.id}
        onRespond={onToolCallRespond}
        responding={isRespondingToToolCall}
        toolCalls={renderedToolCalls}
      />

      <Pressable
        onPress={isStreaming ? undefined : handleActivate}
        style={[isUser ? styles.userBubble : styles.assistantBubble, isUser && styles.continuous]}
        testID={`chat-message-${message.id}`}
      >
        {!isUser && hasReasoning ? (
          <View style={styles.reasoningPanel}>
            <Text style={styles.reasoningText}>{message.reasoning}</Text>
          </View>
        ) : null}

        <Animated.View layout={contentLayout} style={styles.content}>
          <MessageContent content={content} enableMarkdown={!isStreaming} textStyle={textStyle}>
            {!isUser && isStreaming ? <ChatThinkingIndicator /> : null}
          </MessageContent>

          {failed && isUser ? (
            <Animated.View entering={bannerEntering} exiting={bannerExiting}>
              <Pressable
                accessibilityLabel={t.chat.retryMessageA11y}
                accessibilityRole="button"
                style={styles.retryRow}
                onPress={() => onRetry?.(message.id)}
              >
                <AppIcon name="exclamationmark.circle.fill" size={13} tintColor={destructive} />
                <Text style={{ color: destructive, fontSize: 12 }}>
                  {message.error || t.chat.failedToSend} · {t.chat.tapToRetry}
                </Text>
              </Pressable>
            </Animated.View>
          ) : null}

          {failed && !isUser ? (
            <Animated.View entering={bannerEntering} exiting={bannerExiting}>
              <View style={styles.interruptedRow}>
                <AppIcon name="exclamationmark.circle" size={13} tintColor={tertiary} />
                <Text style={{ color: tertiary, fontSize: 12 }}>{t.chat.responseInterrupted}</Text>
              </View>
            </Animated.View>
          ) : null}

          {showDebug && !isStreaming ? (
            <MessageDebug hasReasoning={hasReasoning} message={message} />
          ) : null}
        </Animated.View>
      </Pressable>
      <ActiveMessageActions
        actions={{ canDelete, canEdit, canRegenerate }}
        isActive={isActive}
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
