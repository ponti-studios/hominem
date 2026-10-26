import { Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { nativeMotionAnimations } from '~/services/motion/native-motion';
import t from '~/translations';

// The composer pill's resting height (Composer's surfaceContent minHeight), so
// swapping between the two never moves the conversation above.
const BAR_HEIGHT = 52;

interface ChatGenerationFailedBarProps {
  onRetry?: () => void;
  // Puts the failed message back in the composer. Hidden when there is no
  // message to restore.
  onEdit?: () => void;
}

// Takes the composer's place when a reply fails: coral-ringed, with retry and
// edit. Working and stopping have no bar of their own -- the thinking
// indicator in the reply bubble is the only "working" signal, and the composer
// swaps its send button for stop. Matches the composer's resting height so the
// conversation above does not jump on the swap.
export function ChatGenerationFailedBar({ onEdit, onRetry }: ChatGenerationFailedBarProps) {
  const styles = useStyles((theme) => ({
    bar: {
      alignItems: 'center',
      backgroundColor: theme.colors.bar,
      borderColor: theme.colors.coral,
      borderCurve: 'continuous',
      borderRadius: BAR_HEIGHT / 2,
      borderWidth: 2,
      boxShadow: theme.shadows.bar,
      flexDirection: 'row',
      gap: 12,
      height: BAR_HEIGHT,
      overflow: 'hidden',
      paddingLeft: 6,
      paddingRight: 6,
    },
    failedBadge: {
      alignItems: 'center',
      backgroundColor: theme.colors.coral,
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    failedBody: { flex: 1, minWidth: 0 },
    failedTitle: { color: theme.colors.barForeground, fontSize: 16, fontWeight: '800' },
    failedDetail: {
      color: theme.colors.barForeground,
      fontSize: 12,
      fontWeight: '600',
      opacity: 0.65,
    },
    retryButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.lime,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    editButton: {
      alignItems: 'center',
      backgroundColor: theme.colors.barControl,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
  }));
  const { barForeground, limeForeground } = useAppTheme().colors;
  return (
    <Animated.View
      entering={nativeMotionAnimations.fadeInQuick}
      exiting={nativeMotionAnimations.fadeOutQuick}
      testID="chat-generation-bar"
    >
      <View accessibilityLiveRegion="polite" style={styles.bar} testID="chat-activity">
        <View style={styles.failedBadge}>
          <AppIcon name="exclamationmark" size={20} tintColor={limeForeground} />
        </View>
        <View style={styles.failedBody}>
          <Text numberOfLines={1} style={styles.failedTitle}>
            {t.chat.generation.failed}
          </Text>
          <Text numberOfLines={1} style={styles.failedDetail}>
            {t.chat.generation.failedBarDetail}
          </Text>
        </View>
        {onRetry ? (
          <Pressable
            accessibilityLabel={t.chat.generation.retryA11y}
            accessibilityRole="button"
            onPress={onRetry}
            style={styles.retryButton}
            testID="chat-generation-retry"
          >
            <AppIcon name="arrow.clockwise" size={20} tintColor={limeForeground} />
          </Pressable>
        ) : null}
        {onEdit ? (
          <Pressable
            accessibilityLabel={t.chat.generation.editA11y}
            accessibilityRole="button"
            onPress={onEdit}
            style={styles.editButton}
            testID="chat-generation-edit"
          >
            <AppIcon name="square.and.pencil" size={20} tintColor={barForeground} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
