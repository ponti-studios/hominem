import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';

const RISE_DISTANCE = 18;

// Fades its children in and lifts them into place once `active` is true. Reduced motion keeps the fade
// and drops the lift.
export function RiseIn({
  active,
  children,
  delay = 0,
  style,
}: {
  active: boolean;
  children: ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.set(
      active
        ? withDelay(
            reducedMotion ? 0 : delay,
            withTiming(1, {
              duration: reducedMotion ? 200 : 600,
              easing: Easing.bezier(0.22, 0.9, 0.24, 1),
            }),
          )
        : 0,
    );
  }, [active, delay, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - progress.value) * RISE_DISTANCE }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
