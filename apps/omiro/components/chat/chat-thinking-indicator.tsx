import { Canvas, Group, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  FadeOutUp,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionContracts } from '~/services/motion/native-motion';
import t from '~/translations';

// Mirrors the web Shimmer ("Thinking"): a muted label whose glyphs are
// briefly "erased" to the page background by a soft-edged band sweeping
// left to right. Keeps the same 1s linear loop, spread of 2px per character
// (half the band's width-shaped ramp), and a sweep that travels from
// -0.25x to 1.25x the label width -- the geometry of the web's 250%-wide
// background layer.
const SHIMMER_DURATION_MS = 1000;
const SHIMMER_SPREAD_PER_CHAR = 2;
// Fraction-of-width offsets for the band center across one sweep.
const SWEEP_START = -0.25;
const SWEEP_SPAN = 1.5;

function useShimmerProgress(reducedMotion: boolean) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);

    if (reducedMotion) {
      progress.value = 0;
      return;
    }

    progress.value = withRepeat(
      withTiming(1, { duration: SHIMMER_DURATION_MS, easing: Easing.linear }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(progress);
    };
  }, [progress, reducedMotion]);

  return progress;
}

// Generic version of the erase-sweep: any muted label can shimmer, so the
// same visual language covers streaming, regeneration, and save/stop states
// instead of each one inventing its own spinner or card.
export function ShimmerText({ label, style }: { label: string; style?: object }) {
  const { background } = useAppTheme().colors;
  const styles = useStyles(() => ({
    sweep: { position: 'absolute', top: 0, left: 0 },
  }));
  const reducedMotion = useReducedMotion();
  const progress = useShimmerProgress(reducedMotion);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setSize({ height, width });
  };

  const spread = label.length * SHIMMER_SPREAD_PER_CHAR;
  const bandWidth = spread * 2;

  const bandTransform = useDerivedValue(() => {
    const width = size?.width ?? 0;
    const center = width * (SWEEP_START + SWEEP_SPAN * progress.value);
    return [{ translateX: center - bandWidth / 2 }];
  }, [bandWidth, progress, size]);

  return (
    <View collapsable={false} onLayout={onLayout}>
      <Text style={style}>{label}</Text>
      {size && !reducedMotion ? (
        <View pointerEvents="none" style={styles.sweep}>
          <Canvas style={{ height: size.height, width: size.width }}>
            <Group transform={bandTransform}>
              <Rect height={size.height} width={bandWidth} x={0} y={0}>
                <LinearGradient
                  colors={[`${background}00`, background, `${background}00`]}
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

export function ChatThinkingIndicator() {
  const styles = useStyles((theme) => ({
    container: { alignSelf: 'flex-start' },
    row: { paddingTop: 4 },
    label: { color: theme.colors.mutedForeground, fontSize: 14, lineHeight: 20 },
  }));
  const reducedMotion = useReducedMotion();

  return (
    <Animated.View
      exiting={
        reducedMotion
          ? FadeOut.duration(nativeMotionContracts.duration.quick)
          : FadeOutUp.duration(nativeMotionContracts.duration.quick)
      }
      style={styles.container}
      testID="chat-assistant-activity"
    >
      <View style={styles.row}>
        <ShimmerText label={t.chat.thinkingIndicator} style={styles.label} />
      </View>
    </Animated.View>
  );
}
