import { ShimmerText as KitShimmerText } from '@hominem/rn-kit';
import { useEffect } from 'react';
import { View, type TextStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeOut,
  FadeOutUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme, useStyles } from '~/components/theme';
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

const SPARK_SIZE = 18;
const SPARK_RAYS = 4;
const SPIN_MS = 3200;
const PULSE_MS = 1600;

// A small spark: four hairline rays through one point. It turns slowly and
// breathes, both off shared values, so it runs entirely on the UI thread.
function Spark({ color, reduced }: { color: string; reduced: boolean }) {
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      return;
    }
    spin.set(withRepeat(withTiming(1, { duration: SPIN_MS, easing: Easing.linear }), -1, false));
    pulse.set(
      withRepeat(
        withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [pulse, reduced, spin]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.55, 1]),
    transform: [
      { rotate: `${spin.value * 90}deg` },
      { scale: interpolate(pulse.value, [0, 1], [0.82, 1]) },
    ],
  }));

  return (
    <Animated.View style={[{ height: SPARK_SIZE, width: SPARK_SIZE }, reduced ? undefined : style]}>
      {Array.from({ length: SPARK_RAYS }, (_, index) => (
        <View
          key={index}
          style={{
            backgroundColor: color,
            borderRadius: 1,
            height: 2,
            left: 0,
            position: 'absolute',
            top: SPARK_SIZE / 2 - 1,
            transform: [{ rotate: `${(index * 180) / SPARK_RAYS}deg` }],
            width: SPARK_SIZE,
          }}
        />
      ))}
    </Animated.View>
  );
}

export function ChatThinkingIndicator() {
  const styles = useStyles((theme) => ({
    container: { alignSelf: 'stretch' },
    row: { alignItems: 'center', flexDirection: 'row', gap: 10 },
    label: { color: theme.colors.mutedForeground, fontSize: 15 },
  }));
  const reducedMotion = useReducedMotion();
  const { card, primary } = useAppTheme().colors;

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
        <Spark color={primary} reduced={reducedMotion} />
        <KitShimmerText fadeColor={card} label={t.chat.generation.thinking} style={styles.label} />
      </View>
    </Animated.View>
  );
}
