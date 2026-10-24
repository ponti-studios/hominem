import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { useReducedMotion } from './use-reduced-motion';
import { useShimmerProgress } from './use-shimmer-progress';

export interface ShimmerTextProps {
  label: string;
  /**
   * The surface colour the label sits on. The sweep erases glyphs to this
   * colour, so it must match what is directly behind the text.
   */
  fadeColor: string;
  style?: StyleProp<TextStyle>;
  /** Style for the wrapper (it hugs the label by default). */
  containerStyle?: StyleProp<ViewStyle>;
  /** One full sweep, in ms. Default 1000. */
  durationMs?: number;
  /** Half-width of the soft band contributed by each character, in px. Default 2. */
  spreadPerChar?: number;
  /** Band centre at the start of a sweep, as a fraction of the label width. Default -0.25. */
  sweepStart?: number;
  /** Distance the band travels, as a fraction of the label width. Default 1.5. */
  sweepSpan?: number;
  /** Force reduced motion on or off; follows the system setting when omitted. */
  reducedMotion?: boolean;
}

/**
 * A label whose glyphs are briefly "erased" to `fadeColor` by a soft-edged band
 * sweeping left to right. The sweep is confined to the label's own box.
 */
export function ShimmerText({
  label,
  fadeColor,
  style,
  containerStyle,
  durationMs,
  spreadPerChar = 2,
  sweepStart = -0.25,
  sweepSpan = 1.5,
  reducedMotion,
}: ShimmerTextProps) {
  const systemReducedMotion = useReducedMotion();
  const isReducedMotion = reducedMotion ?? systemReducedMotion;
  const progress = useShimmerProgress({ durationMs, reducedMotion: isReducedMotion });
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setSize({ height, width });
  };

  const bandWidth = label.length * spreadPerChar * 2;

  const bandTransform = useDerivedValue(() => {
    const width = size?.width ?? 0;
    const center = width * (sweepStart + sweepSpan * progress.value);
    return [{ translateX: center - bandWidth / 2 }];
  }, [bandWidth, progress, size, sweepSpan, sweepStart]);

  return (
    <View collapsable={false} onLayout={onLayout} style={[styles.root, containerStyle]}>
      <Text style={style}>{label}</Text>
      {size && !isReducedMotion ? (
        <View pointerEvents="none" style={styles.sweep}>
          <Canvas style={{ height: size.height, width: size.width }}>
            <Group transform={bandTransform}>
              <Rect height={size.height} width={bandWidth} x={0} y={0}>
                <LinearGradient
                  colors={[`${fadeColor}00`, fadeColor, `${fadeColor}00`]}
                  end={vec(bandWidth, 0)}
                  positions={[0, 0.5, 1]}
                  start={vec(0, 0)}
                />
              </Rect>
            </Group>
          </Canvas>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Hug the label: in a flex row the wrapper would stretch and the sweep would
  // cross the whole row instead of just the text.
  root: { alignSelf: 'flex-start' },
  sweep: { left: 0, position: 'absolute', top: 0 },
});
