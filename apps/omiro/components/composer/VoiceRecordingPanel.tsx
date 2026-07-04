import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { RecordingLevelMeter } from '~/components/composer/RecordingLevelMeter';
import { useElapsedTimer } from '~/components/composer/useElapsedTimer';
import { Text, makeStyles, useThemeColors } from '~/components/theme';
import { IconButton } from '~/components/ui/icon-button';
import t from '~/translations';

const TOOL_BTN_SIZE = 38; // ToolBtn / SecondaryBtn per composer spec
const TOOLBAR_ICON_SIZE = 20; // toolbar action icon size

interface VoiceRecordingPanelProps {
  startedAt: number | null;
  onCancel: () => void;
  onDone?: () => void;
  doneAccessibilityLabel?: string;
}

export function VoiceRecordingPanel({ startedAt, onCancel, onDone, doneAccessibilityLabel }: VoiceRecordingPanelProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();
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
        <RecordingLevelMeter />
      </View>
      {onDone ? (
        <IconButton
          accessibilityLabel={
            doneAccessibilityLabel ?? t.inboxComposer.composer.stopVoiceInputA11y
          }
          circular
          disabled={false}
          icon="stop.fill"
          iconSize={TOOLBAR_ICON_SIZE}
          size={TOOL_BTN_SIZE}
          variant="primary"
          onPress={onDone}
        />
      ) : null}
      <IconButton
        accessibilityLabel={t.inboxComposer.composer.cancelRecordingA11y}
        circular
        disabled={false}
        icon="xmark"
        iconSize={TOOLBAR_ICON_SIZE}
        size={TOOL_BTN_SIZE}
        tintColor={themeColors['icon-muted']}
        variant="surface"
        onPress={onCancel}
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
