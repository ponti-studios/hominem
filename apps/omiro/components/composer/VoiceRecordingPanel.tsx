import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { ActionButton } from '~/components/composer/ComposerButtons';
import { RecordingLevelMeter } from '~/components/composer/RecordingLevelMeter';
import { useElapsedTimer } from '~/components/composer/useElapsedTimer';
import { Text, makeStyles } from '~/components/theme';
import t from '~/translations';

interface VoiceRecordingPanelProps {
  startedAt: number | null;
  meterings: number[];
  onCancel: () => void;
}

export function VoiceRecordingPanel({ startedAt, meterings, onCancel }: VoiceRecordingPanelProps) {
  const styles = useStyles();
  const elapsed = useElapsedTimer(startedAt);
  const dotOpacity = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    ),
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, dotOpacity]} />
      <Text style={styles.timer}>{elapsed}</Text>
      <View style={styles.meter}>
        <RecordingLevelMeter meterings={meterings} />
      </View>
      <ActionButton
        icon="xmark"
        onPress={onCancel}
        accessibilityLabel={t.inboxComposer.composer.cancelRecordingA11y}
        disabled={false}
        variant="muted"
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingBottom: spacing[1],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.destructive,
  },
  timer: {
    color: theme.colors['text-secondary'],
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
  },
  meter: {
    flex: 1,
  },
}));
