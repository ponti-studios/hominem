import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { useShimmerProgress } from '~/hooks/use-shimmer-progress';

interface ShimmerProgressBarProps {
  progress: number;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  trackColor?: string;
  fillColor?: string;
}

const DEFAULT_HEIGHT = 3;
const DEFAULT_BORDER_RADIUS = 999;
// Fraction-of-track-width offsets for the sweep band's travel across one loop.
const SWEEP_SPAN = 1.6;
const SWEEP_START = -0.3;

// The one linear progress bar for the app: track + fill, with the same
// "erase to background" shimmer sweep used by ShimmerText, so every
// determinate progress indicator (stage progress, uploads, usage meters)
// moves and reads the same way.
export function ShimmerProgressBar({
  progress,
  height = DEFAULT_HEIGHT,
  borderRadius = DEFAULT_BORDER_RADIUS,
  style,
  trackColor,
  fillColor,
}: ShimmerProgressBarProps) {
  const { background, border, primary } = useAppTheme().colors;
  const reducedMotion = useReducedMotion();
  const [trackWidth, setTrackWidth] = useState(0);
  const clampedProgress = Math.max(0, Math.min(1, progress));

  const fillProgress = useSharedValue(clampedProgress);
  useEffect(() => {
    fillProgress.value = reducedMotion
      ? clampedProgress
      : withTiming(clampedProgress, { duration: 500 });
  }, [clampedProgress, fillProgress, reducedMotion]);

  const shimmerProgress = useShimmerProgress(reducedMotion);
  const bandWidth = Math.max(trackWidth * 0.4, 20);
  const sweepTransform = useDerivedValue(() => {
    const span = trackWidth * SWEEP_SPAN;
    const x = trackWidth * SWEEP_START + shimmerProgress.value * span;
    return [{ translateX: x }];
  }, [bandWidth, shimmerProgress, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fillProgress.value * 100}%` }));

  const styles = useStyles(() => ({
    track: {
      height,
      borderRadius,
      backgroundColor: trackColor ?? border,
      overflow: 'hidden',
    },
    fill: {
      height: '100%',
      borderRadius,
      backgroundColor: fillColor ?? primary,
      overflow: 'hidden',
    },
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View onLayout={onLayout} style={[styles.track, style]}>
      <Animated.View style={[styles.fill, fillStyle]}>
        {trackWidth > 0 && !reducedMotion ? (
          <Canvas style={{ height, width: trackWidth }}>
            <Group transform={sweepTransform}>
              <Rect height={height} width={bandWidth} x={0} y={0}>
                <LinearGradient
                  colors={[`${background}00`, `${background}80`, `${background}00`]}
                  end={vec(bandWidth, 0)}
                  positions={[0, 0.5, 1]}
                  start={vec(0, 0)}
                />
              </Rect>
            </Group>
          </Canvas>
        ) : null}
      </Animated.View>
    </View>
  );
}
