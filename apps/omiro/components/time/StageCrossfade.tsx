import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  useDerivedValue,
} from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { ShimmerProgressBar } from '~/components/ui/shimmer-progress-bar';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useShimmerProgress } from '~/hooks/use-shimmer-progress';

const DOT_SIZE = 8;

export interface StageCrossfadeStage<T extends string> {
  id: T;
  label: string;
}

interface StageCrossfadeProps<T extends string> {
  current: T;
  stages: StageCrossfadeStage<T>[];
}

// A single centered line of text that hands off between stages (rising in as
// the previous one lifts away), with a bar below tracking how far through
// `stages` the current one is. Generic over the stage id so any ordered,
// named sequence can drive it -- not just Time's processing stages.
export function StageCrossfade<T extends string>({ current, stages }: StageCrossfadeProps<T>) {
  const reducedMotion = useReducedMotion();
  const { background, primary } = useAppTheme().colors;
  const styles = useStyles((currentTheme) => ({
    container: { alignItems: 'center', gap: 14 },
    line: { height: 28, justifyContent: 'center', alignItems: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    dot: {
      width: DOT_SIZE,
      height: DOT_SIZE,
      borderRadius: 999,
      backgroundColor: currentTheme.colors.primary,
      overflow: 'hidden',
    },
    label: { ...currentTheme.textVariants.headline, color: currentTheme.colors.foreground },
    track: { width: '100%', maxWidth: 200 },
  }));

  const activeIndex = Math.max(
    stages.findIndex((candidate) => candidate.id === current),
    0,
  );
  const activeStage = stages[activeIndex];
  const targetProgress = activeIndex / Math.max(stages.length - 1, 1);

  const dotShimmer = useShimmerProgress(reducedMotion);
  const dotSweepTransform = useDerivedValue(() => {
    const span = DOT_SIZE * 2;
    return [{ translateX: -DOT_SIZE + dotShimmer.value * span }];
  }, [dotShimmer]);

  const entering = reducedMotion ? FadeIn.duration(150) : FadeInUp.duration(350);
  const exiting = reducedMotion ? FadeOut.duration(150) : FadeOutUp.duration(280);

  return (
    <View accessibilityLiveRegion="polite" accessibilityRole="progressbar" style={styles.container}>
      <View style={styles.line}>
        <Animated.View
          entering={entering}
          exiting={exiting}
          key={activeStage.id}
          style={styles.row}
        >
          <View style={styles.dot}>
            {!reducedMotion ? (
              <Canvas style={{ height: DOT_SIZE, width: DOT_SIZE }}>
                <Group transform={dotSweepTransform}>
                  <Rect height={DOT_SIZE} width={DOT_SIZE} x={0} y={0}>
                    <LinearGradient
                      colors={[`${background}00`, `${background}80`, `${background}00`]}
                      end={vec(DOT_SIZE, 0)}
                      positions={[0, 0.5, 1]}
                      start={vec(0, 0)}
                    />
                  </Rect>
                </Group>
              </Canvas>
            ) : null}
          </View>
          <Text style={styles.label}>{activeStage.label}</Text>
        </Animated.View>
      </View>
      <ShimmerProgressBar fillColor={primary} progress={targetProgress} style={styles.track} />
    </View>
  );
}
