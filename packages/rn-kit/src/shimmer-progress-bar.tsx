import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from './use-reduced-motion';
import { useShimmerProgress } from './use-shimmer-progress';

export interface ShimmerProgressBarProps {
  /** 0 to 1; values outside are clamped. */
  progress: number;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  trackColor?: string;
  fillColor?: string;
  /** Colour the sweep erases the fill toward; match the surface behind the bar. */
  fadeColor?: string;
  /** One full sweep, in ms. Default 1000. */
  shimmerDurationMs?: number;
  /** How long the fill takes to catch up to a new `progress`, in ms. Default 500. */
  fillDurationMs?: number;
  /** Sweep band width as a fraction of the track. Default 0.4. */
  bandWidthFraction?: number;
  reducedMotion?: boolean;
}

// Fraction-of-track-width offsets for the sweep band's travel across one loop.
const SWEEP_SPAN = 1.6;
const SWEEP_START = -0.3;

/** Track + fill with the same "erase to background" sweep as ShimmerText. */
export function ShimmerProgressBar({
  progress,
  height = 3,
  borderRadius = 999,
  style,
  trackColor = '#E5E5EA',
  fillColor = '#6C4DFF',
  fadeColor = '#FFFFFF',
  shimmerDurationMs,
  fillDurationMs = 500,
  bandWidthFraction = 0.4,
  reducedMotion,
}: ShimmerProgressBarProps) {
  const systemReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? systemReducedMotion;
  const [trackWidth, setTrackWidth] = useState(0);
  const clamped = Math.max(0, Math.min(1, progress));

  const fillProgress = useSharedValue(clamped);
  useEffect(() => {
    fillProgress.set(isReducedMotion ? clamped : withTiming(clamped, { duration: fillDurationMs }));
  }, [clamped, fillProgress, isReducedMotion, fillDurationMs]);

  const shimmerProgress = useShimmerProgress({
    durationMs: shimmerDurationMs,
    reducedMotion: isReducedMotion,
  });
  const bandWidth = Math.max(trackWidth * bandWidthFraction, 20);
  const sweepTransform = useDerivedValue(() => {
    const x = trackWidth * SWEEP_START + shimmerProgress.value * trackWidth * SWEEP_SPAN;
    return [{ translateX: x }];
  }, [shimmerProgress, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fillProgress.value * 100}%` }));

  const onLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  return (
    <View
      onLayout={onLayout}
      style={[styles.track, { backgroundColor: trackColor, borderRadius, height }, style]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: fillColor, borderRadius }, fillStyle]}>
        {trackWidth > 0 && !isReducedMotion ? (
          <Canvas style={{ height, width: trackWidth }}>
            <Group transform={sweepTransform}>
              <Rect height={height} width={bandWidth} x={0} y={0}>
                <LinearGradient
                  colors={[`${fadeColor}00`, `${fadeColor}80`, `${fadeColor}00`]}
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

const styles = StyleSheet.create({
  fill: { height: '100%', overflow: 'hidden' },
  track: { overflow: 'hidden' },
});
