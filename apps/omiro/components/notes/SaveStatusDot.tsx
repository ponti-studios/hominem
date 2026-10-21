import { useEffect, useState } from 'react';
import { Animated, Easing, View } from 'react-native';

import { useAppTheme } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import type { SaveIndicator } from '~/hooks/use-save-indicator';

const SLOT_WIDTH = 16;
const DOT_SIZE = 7;
const FADE_MS = 600;
const PULSE_MS = 1100;

interface SaveStatusDotProps {
  indicator: SaveIndicator;
  accessibilityLabel?: string;
}

/**
 * The dot always owns a 16pt slot, so the buttons next to it never move when it appears. It fades
 * out when the indicator goes back to 'none' and stops pulsing under Reduce Motion.
 */
export function SaveStatusDot({ indicator, accessibilityLabel }: SaveStatusDotProps) {
  const { colors } = useAppTheme();
  const reduceMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(0));
  // Keep the last visible colour while fading out.
  const [lastVisible, setLastVisible] = useState<Exclude<SaveIndicator, 'none'>>('saving');
  if (indicator !== 'none' && indicator !== lastVisible) {
    setLastVisible(indicator);
  }

  useEffect(() => {
    if (indicator === 'none') {
      if (reduceMotion) {
        opacity.setValue(0);
        return undefined;
      }
      const fade = Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      });
      fade.start();
      return () => fade.stop();
    }
    if (indicator === 'saving' && !reduceMotion) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.45,
            duration: PULSE_MS / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: PULSE_MS / 2,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
    opacity.setValue(1);
    return undefined;
  }, [indicator, opacity, reduceMotion]);

  const color = {
    saving: colors.mutedForeground,
    saved: colors.success,
    offline: colors.warning,
    error: colors.destructive,
  }[lastVisible];

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion="polite"
      accessible={Boolean(accessibilityLabel)}
      style={{ alignItems: 'center', height: 32, justifyContent: 'center', width: SLOT_WIDTH }}
      testID="note-save-status"
    >
      <Animated.View
        style={{
          backgroundColor: color,
          borderRadius: DOT_SIZE / 2,
          height: DOT_SIZE,
          opacity,
          width: DOT_SIZE,
        }}
      />
    </View>
  );
}
