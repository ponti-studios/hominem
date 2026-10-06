import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import t from '~/translations';

import { formatToolName } from './chat-tool-call.helpers';

interface ChatToolApprovalBarProps {
  disabled?: boolean;
  onApprove: () => void;
  onReject: () => void;
  toolName: string;
}

// The composer, flattened into the one decision the conversation is waiting
// on: Reject on the left, the question in the middle, Approve on the right.
// Same 56px lime bar as the generation bar, so the screen's bottom edge keeps
// one language while the assistant works or waits.
export function ChatToolApprovalBar({
  disabled,
  onApprove,
  onReject,
  toolName,
}: ChatToolApprovalBarProps) {
  const { inkForeground, lime } = useAppTheme().colors;
  const name = formatToolName(toolName);
  const styles = useStyles((theme) => ({
    bar: {
      alignItems: 'center',
      backgroundColor: theme.colors.lime,
      borderCurve: 'continuous',
      borderRadius: 28,
      boxShadow: theme.shadows.float,
      flexDirection: 'row',
      gap: 8,
      height: 56,
      paddingHorizontal: 6,
    },
    reject: {
      alignItems: 'center',
      backgroundColor: theme.colors.ink,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    question: {
      color: theme.colors.limeForeground,
      flex: 1,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: -0.3,
      textAlign: 'center',
    },
    approve: {
      alignItems: 'center',
      backgroundColor: theme.colors.ink,
      borderRadius: 22,
      flexDirection: 'row',
      gap: 6,
      height: 44,
      paddingLeft: 14,
      paddingRight: 18,
    },
    approveText: { color: theme.colors.lime, fontSize: 16, fontWeight: '800' },
    disabled: { opacity: 0.5 },
  }));

  return (
    <Animated.View entering={FadeIn.duration(160)} testID="chat-tool-approval-bar">
      <View accessibilityLiveRegion="polite" style={styles.bar}>
        <Pressable
          accessibilityLabel={t.chat.toolCall.rejectA11y(name)}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onReject}
          style={[styles.reject, disabled && styles.disabled]}
          testID="tool-confirm-reject"
        >
          <AppIcon name="xmark" size={18} tintColor={inkForeground} />
        </Pressable>
        <Text numberOfLines={1} style={styles.question}>
          {t.chat.toolCall.question(name)}
        </Text>
        <Pressable
          accessibilityLabel={t.chat.toolCall.approveA11y(name)}
          accessibilityRole="button"
          disabled={disabled}
          onPress={onApprove}
          style={[styles.approve, disabled && styles.disabled]}
          testID="tool-confirm-approve"
        >
          <AppIcon name="checkmark" size={16} tintColor={lime} />
          <Text style={styles.approveText}>{t.chat.toolCall.approve}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
