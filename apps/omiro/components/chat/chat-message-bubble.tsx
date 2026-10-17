import type { ChatMessageItem } from '@hominem/chat';
import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import AppIcon from '~/components/ui/icon';
import { nativeMotionAnimations } from '~/services/motion/native-motion';
import t from '~/translations';

import { MessageContent } from './chat-message-content';
import { MessageDebug } from './chat-message-debug';
import type { ChatMessageStyles } from './chat-message.styles';
import { ChatThinkingIndicator } from './chat-thinking-indicator';

export function ChatMessageBubble({
  message,
  styles,
  isUser,
  showDebug,
  isNewlyFailed,
  reducedMotion,
  onActivate,
  onRetry,
}: {
  message: ChatMessageItem;
  styles: ChatMessageStyles;
  isUser: boolean;
  showDebug: boolean;
  isNewlyFailed: boolean;
  reducedMotion: boolean;
  onActivate?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
}) {
  const isStreaming = Boolean(message.isStreaming);
  const bannerEntering = isNewlyFailed
    ? reducedMotion
      ? nativeMotionAnimations.fadeInQuick
      : nativeMotionAnimations.fadeInDownQuick
    : undefined;
  const bannerExiting = reducedMotion
    ? nativeMotionAnimations.fadeOutQuick
    : nativeMotionAnimations.fadeOutUpQuick;
  const contentLayout = reducedMotion ? undefined : nativeMotionAnimations.layoutQuick;
  const textStyle = isUser ? styles.userText : styles.assistantText;

  return (
    <Pressable
      onPress={isStreaming ? undefined : () => onActivate?.(message.id)}
      style={[isUser ? styles.userBubble : styles.assistantBubble, isUser && styles.continuous]}
      testID={`chat-message-${message.id}`}
    >
      <MessageReasoning message={message} isUser={isUser} styles={styles} />

      <Animated.View layout={contentLayout} style={styles.content}>
        {/* The user's own text is shown verbatim: underscores or asterisks they
            typed must not turn into emphasis. */}
        <MessageContent
          content={message.message}
          enableMarkdown={!isUser && !isStreaming}
          textStyle={textStyle}
        >
          <AssistantThinkingIndicator isStreaming={isStreaming} isUser={isUser} />
        </MessageContent>

        <MessageFailureNotice
          message={message}
          isUser={isUser}
          onRetry={onRetry}
          bannerEntering={bannerEntering}
          bannerExiting={bannerExiting}
          styles={styles}
        />
        <MessageDebugPanel message={message} showDebug={showDebug} isStreaming={isStreaming} />
      </Animated.View>
    </Pressable>
  );
}

function MessageReasoning({
  message,
  isUser,
  styles,
}: {
  message: ChatMessageItem;
  isUser: boolean;
  styles: ChatMessageStyles;
}) {
  if (isUser || !message.reasoning?.trim()) {
    return null;
  }
  return (
    <View style={styles.reasoningPanel}>
      <Text style={styles.reasoningText}>{message.reasoning}</Text>
    </View>
  );
}

function AssistantThinkingIndicator({
  isStreaming,
  isUser,
}: {
  isStreaming: boolean;
  isUser: boolean;
}) {
  if (isUser || !isStreaming) {
    return null;
  }
  return <ChatThinkingIndicator />;
}

function MessageFailureNotice({
  message,
  isUser,
  onRetry,
  bannerEntering,
  bannerExiting,
  styles,
}: {
  message: ChatMessageItem;
  isUser: boolean;
  onRetry?: (messageId: string) => void;
  bannerEntering:
    | typeof nativeMotionAnimations.fadeInQuick
    | typeof nativeMotionAnimations.fadeInDownQuick
    | undefined;
  bannerExiting:
    | typeof nativeMotionAnimations.fadeOutQuick
    | typeof nativeMotionAnimations.fadeOutUpQuick;
  styles: ChatMessageStyles;
}) {
  if (!message.failed) {
    return null;
  }
  if (isUser) {
    return (
      <Animated.View entering={bannerEntering} exiting={bannerExiting}>
        <Pressable
          accessibilityLabel={t.chat.retryMessageA11y}
          accessibilityRole="button"
          style={styles.retryRow}
          onPress={() => onRetry?.(message.id)}
        >
          <AppIcon
            name="exclamationmark.circle.fill"
            size={13}
            tintColor={styles.retryText.color}
          />
          <Text style={styles.retryText}>
            {message.error || t.chat.failedToSend} · {t.chat.tapToRetry}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }
  return (
    <Animated.View entering={bannerEntering} exiting={bannerExiting}>
      <View style={styles.interruptedRow}>
        <AppIcon name="exclamationmark.circle" size={13} tintColor={styles.interruptedText.color} />
        <Text style={styles.interruptedText}>{t.chat.responseInterrupted}</Text>
      </View>
    </Animated.View>
  );
}

function MessageDebugPanel({
  message,
  showDebug,
  isStreaming,
}: {
  message: ChatMessageItem;
  showDebug: boolean;
  isStreaming: boolean;
}) {
  if (!showDebug || isStreaming) {
    return null;
  }
  return (
    <MessageDebug
      hasReasoning={Boolean(message.reasoning && message.reasoning.trim().length > 0)}
      message={message}
    />
  );
}
