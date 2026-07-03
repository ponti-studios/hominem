import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { makeStyles, shadowsNative, useThemeColors } from '~/components/theme';

interface ComposerShellProps {
  accessory?: React.ReactNode;
  inlinePanel?: React.ReactNode;
  toolbar: React.ReactNode;
  input: React.ReactNode;
  testID?: string;
  isRecording?: boolean;
}

export function ComposerShell({
  accessory,
  inlinePanel,
  toolbar,
  input,
  testID,
  isRecording = false,
}: ComposerShellProps) {
  const styles = useStyles();
  const themeColors = useThemeColors();

  // A subtle ambient cue on the card's own edge — distinct from the recording
  // panel's own indicator dot — so the "you're recording" state stays visible
  // in peripheral vision even if you look away from the panel itself.
  const recordingBorderStyle = useAnimatedStyle(() => ({
    borderColor: isRecording
      ? withRepeat(
          withTiming(themeColors.destructive, {
            duration: 900,
            easing: Easing.inOut(Easing.ease),
          }),
          -1,
          true,
        )
      : themeColors['border-subtle'],
  }));

  return (
    <Animated.View style={[styles.surface, recordingBorderStyle]} testID={testID}>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      {isRecording ? null : <View style={styles.inputRow}>{input}</View>}
      {inlinePanel ? <View style={styles.inlinePanel}>{inlinePanel}</View> : null}
      <View style={styles.toolbarRow}>{toolbar}</View>
    </Animated.View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    ...shadowsNative.low,
    backgroundColor: theme.colors['bg-base'],
    borderColor: theme.colors['border-subtle'],
    borderWidth: 1,
    borderRadius: radii.xl,
    elevation: 6,
    overflow: 'hidden',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[1],
    width: '100%',
  },
  accessory: {
    width: '100%',
  },
  inputRow: {
    width: '100%',
  },
  inlinePanel: {
    width: '100%',
  },
  toolbarRow: {
    width: '100%',
  },
}));
