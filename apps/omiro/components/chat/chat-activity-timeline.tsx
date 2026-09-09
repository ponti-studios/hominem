import { Pressable, Text, View } from 'react-native';

import { useStyles } from '~/components/theme';
import type { ChatGenerationState } from '~/services/chat/chat-generation';
import t from '~/translations';

import { ShimmerText } from './chat-thinking-indicator';

const stageCopy = {
  preparing: t.chat.generation.thinking,
  running: t.chat.generation.thinking,
  awaiting_confirmation: t.chat.generation.thinking,
  saving: t.chat.generation.saving,
  stopping: t.chat.generation.stopping,
  failed: t.chat.generation.failed,
  cancelled: t.chat.generation.cancelled,
  committed: t.chat.generation.saving,
} as const;

export function ChatActivityTimeline({
  generation,
  onCancel,
  onRetry,
}: {
  generation: ChatGenerationState;
  onCancel: () => void;
  onRetry?: () => void;
}) {
  const styles = useStyles((theme) => ({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    content: { flexShrink: 1, gap: 2 },
    label: { ...theme.textVariants.footnote, color: theme.colors.mutedForeground },
    failedLabel: { ...theme.textVariants.footnote, color: theme.colors.destructive },
    detail: { ...theme.textVariants.caption1, color: theme.colors.mutedForeground },
    actionText: { ...theme.textVariants.footnote, color: theme.colors.primary },
  }));
  const isActive =
    generation.stage === 'preparing' ||
    generation.stage === 'running' ||
    generation.stage === 'awaiting_confirmation' ||
    generation.stage === 'saving';
  const isIssue = generation.stage === 'failed' || generation.stage === 'cancelled';

  return (
    <View accessibilityLiveRegion="polite" style={styles.row} testID="chat-activity">
      <View style={styles.content}>
        {isActive || generation.stage === 'stopping' ? (
          <ShimmerText label={stageCopy[generation.stage]} style={styles.label} />
        ) : (
          <Text style={isIssue ? styles.failedLabel : styles.label}>
            {stageCopy[generation.stage]}
          </Text>
        )}
        {generation.stage !== 'preparing' ? (
          <Text style={isIssue ? styles.failedLabel : styles.detail}>
            {generation.stage === 'saving'
              ? t.chat.generation.savingDetail
              : generation.stage === 'failed'
                ? (generation.error ?? t.chat.generation.failedDetail)
                : t.chat.generation.preparingDetail}
          </Text>
        ) : null}
      </View>
      {isActive ? (
        <Pressable
          accessibilityLabel={t.chat.generation.stopA11y}
          accessibilityRole="button"
          onPress={onCancel}
          testID="chat-generation-stop"
        >
          <Text style={styles.actionText}>{t.chat.generation.stop}</Text>
        </Pressable>
      ) : null}
      {isIssue && onRetry ? (
        <Pressable
          accessibilityLabel={t.chat.generation.retryA11y}
          accessibilityRole="button"
          onPress={onRetry}
        >
          <Text style={styles.actionText}>{t.chat.generation.retry}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
