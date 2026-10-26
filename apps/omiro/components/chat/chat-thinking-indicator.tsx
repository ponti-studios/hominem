import { ShimmerText as KitShimmerText } from '@hominem/rn-kit';
import { useEffect } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  FadeOutUp,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionContracts } from '~/services/motion/native-motion';
import t from '~/translations';

// Theme adapter over the shared ShimmerText: the sweep erases glyphs to `fade`
// (the surface the label sits on), defaulting to the page background.
export function ShimmerText({
  fade,
  label,
  style,
}: {
  fade?: string;
  label: string;
  style?: TextStyle;
}) {
  const { background } = useAppTheme().colors;
  return <KitShimmerText fadeColor={fade ?? background} label={label} style={style} />;
}

const GRID_COLUMNS = 5;
const GRID_ROWS = 3;
const WAVE_MS = 1200;
// Each cell trails its diagonal neighbour by this much of the wave.
const CELL_LAG = 110 / WAVE_MS;

// One cell of the pixel grid: rest (violet tint) -> primary -> lime -> rest, as
// the diagonal wave passes. All cells read the same shared value, so the whole
// grid is a single UI-thread animation.
function PixelCell({
  colors,
  lag,
  progress,
  reduced,
}: {
  colors: { rest: string; peak: string; flash: string };
  lag: number;
  progress: SharedValue<number>;
  reduced: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const phase = (((progress.value - lag) % 1) + 1) % 1;
    return {
      backgroundColor: interpolateColor(
        phase,
        [0, 0.4, 0.6, 1],
        [colors.rest, colors.peak, colors.flash, colors.rest],
      ),
      transform: [{ scale: interpolate(phase, [0, 0.4, 0.6, 1], [0.7, 1, 1, 0.7]) }],
    };
  });
  return (
    <Animated.View
      style={[
        { borderCurve: 'continuous', borderRadius: 2, height: 8, width: 8 },
        reduced ? { backgroundColor: colors.peak, opacity: 0.35 + lag } : style,
      ]}
    />
  );
}

export function ChatThinkingIndicator() {
  const styles = useStyles((theme) => ({
    container: { alignSelf: 'flex-start' },
    row: { alignItems: 'center', flexDirection: 'row', gap: 16, height: 36 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
      width: GRID_COLUMNS * 8 + (GRID_COLUMNS - 1) * 4,
    },
    label: {
      color: theme.colors.mutedForeground,
      fontFamily: fontFamilies.mono,
      fontSize: 13,
      letterSpacing: 0.2,
    },
  }));
  const reducedMotion = useReducedMotion();
  const { eventViolet, lime, primary } = useAppTheme().colors;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      return;
    }
    progress.set(0);
    progress.set(
      withRepeat(withTiming(1, { duration: WAVE_MS, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  const colors = { rest: eventViolet, peak: primary, flash: lime };
  const cells = Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => ({
    key: index,
    lag: (Math.floor(index / GRID_COLUMNS) + (index % GRID_COLUMNS)) * CELL_LAG,
  }));

  return (
    <Animated.View
      accessibilityLabel={t.chat.thinkingIndicator}
      accessibilityRole="progressbar"
      exiting={
        reducedMotion
          ? FadeOut.duration(nativeMotionContracts.duration.quick)
          : FadeOutUp.duration(nativeMotionContracts.duration.quick)
      }
      style={styles.container}
      testID="chat-assistant-activity"
    >
      <View style={styles.row}>
        <View style={styles.grid}>
          {cells.map((cell) => (
            <PixelCell
              key={cell.key}
              colors={colors}
              lag={cell.lag}
              progress={progress}
              reduced={reducedMotion}
            />
          ))}
        </View>
        <Text style={styles.label}>{t.chat.thinkingIndicator}</Text>
      </View>
    </Animated.View>
  );
}
