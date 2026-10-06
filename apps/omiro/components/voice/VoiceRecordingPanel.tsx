import React from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useStyles, withAlpha } from '~/components/theme';
import { IconButton } from '~/components/ui';
import AppIcon from '~/components/ui/icon';
import { RecordingLevelMeter } from '~/components/voice/RecordingLevelMeter';
import { useElapsedTimer } from '~/components/voice/useElapsedTimer';
import t from '~/translations';

interface VoiceRecordingPanelProps {
  startedAt: number | null;
  onCancel: () => void;
  onDone?: () => void;
  doneAccessibilityLabel?: string;
  // 'ink' for panels that sit on the inverted floating composer surface.
  tone?: 'default' | 'ink';
}

export function VoiceRecordingPanel({
  startedAt,
  onCancel,
  onDone,
  doneAccessibilityLabel,
  tone = 'default',
}: VoiceRecordingPanelProps) {
  const {
    card: cardColor,
    destructive: destructiveColor,
    barForeground,
    mutedForeground,
  } = useAppTheme().colors;
  const onInk = tone === 'ink';
  const pillColor = onInk ? withAlpha(barForeground, 0.16) : cardColor;
  const textSecondaryColor = onInk ? barForeground : mutedForeground;
  const iconTint = onInk ? barForeground : undefined;
  const styles = useStyles(() => ({
    recordingDot: { width: 8, height: 8, borderRadius: 999 },
    recordingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%' },
    recordingContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
    meterContainer: { flex: 1 },
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
    <View style={styles.recordingContainer}>
      <IconButton
        accessibilityLabel={t.inboxComposer.composer.cancelRecordingA11y}
        testID="composer-cancel-recording-button"
        onPress={onCancel}
      >
        <AppIcon name="xmark" size={20} tintColor={iconTint} />
      </IconButton>
      {/* Fills the row between cancel and stop, mirroring the idle row's
          [attach] [text, flex-1] [mic] layout. */}
      <View
        style={[
          styles.recordingContent,
          {
            height: 44,
            paddingHorizontal: 16,
            borderRadius: 22,
            backgroundColor: pillColor,
          },
        ]}
      >
        <Animated.View
          style={[styles.recordingDot, [{ backgroundColor: destructiveColor }, dotOpacity]]}
        />
        <Text
          style={{
            color: textSecondaryColor,
            fontSize: 13,
            fontVariant: ['tabular-nums'],
            minWidth: 34,
          }}
        >
          {elapsed}
        </Text>
        <View style={styles.meterContainer}>
          <RecordingLevelMeter />
        </View>
      </View>
      {onDone ? (
        <IconButton
          accessibilityLabel={doneAccessibilityLabel ?? t.inboxComposer.composer.stopVoiceInputA11y}
          testID="composer-stop-recording-button"
          onPress={onDone}
        >
          <AppIcon name="stop.fill" size={20} tintColor={onInk ? destructiveColor : undefined} />
        </IconButton>
      ) : null}
    </View>
  );
}
