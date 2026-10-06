import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import AppIcon from '~/components/ui/icon';
import { RecordingLevelMeter } from '~/components/voice/RecordingLevelMeter';
import { useElapsedTimer } from '~/components/voice/useElapsedTimer';
import t from '~/translations';

interface VoiceRecordingPanelProps {
  startedAt: number | null;
  onCancel: () => void;
  onDone: () => void;
  doneAccessibilityLabel?: string;
}

// Recording, as the composer flattened into one 44px row: cancel on the left,
// a dot, the timer and the live waveform in the middle, a coral stop on the
// right. It sits on the fixed dark bar, so it uses the bar tokens only.
export function VoiceRecordingPanel({
  startedAt,
  onCancel,
  onDone,
  doneAccessibilityLabel,
}: VoiceRecordingPanelProps) {
  const { barForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    row: { alignItems: 'center', flexDirection: 'row', gap: 10, width: '100%' },
    cancel: {
      alignItems: 'center',
      backgroundColor: theme.colors.barControl,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    status: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 10 },
    dot: { backgroundColor: theme.colors.coral, borderRadius: 999, height: 10, width: 10 },
    timer: {
      color: theme.colors.barForeground,
      fontSize: 15,
      fontVariant: ['tabular-nums'],
      fontWeight: '700',
      minWidth: 36,
    },
    meter: { flex: 1 },
    stop: {
      alignItems: 'center',
      backgroundColor: theme.colors.coral,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
  }));
  const elapsed = useElapsedTimer(startedAt);
  const dotOpacity = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    ),
  }));

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={t.inboxComposer.composer.cancelRecordingA11y}
        accessibilityRole="button"
        onPress={onCancel}
        style={styles.cancel}
        testID="composer-cancel-recording-button"
      >
        <AppIcon name="xmark" size={18} tintColor={barForeground} />
      </Pressable>
      <View style={styles.status}>
        <Animated.View style={[styles.dot, dotOpacity]} />
        <Text style={styles.timer}>{elapsed}</Text>
        <View style={styles.meter}>
          <RecordingLevelMeter />
        </View>
      </View>
      <Pressable
        accessibilityLabel={doneAccessibilityLabel ?? t.inboxComposer.composer.stopVoiceInputA11y}
        accessibilityRole="button"
        onPress={onDone}
        style={styles.stop}
        testID="composer-stop-recording-button"
      >
        <AppIcon name="stop.fill" size={18} tintColor={barForeground} />
      </Pressable>
    </View>
  );
}
