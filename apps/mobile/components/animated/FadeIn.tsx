import React from 'react';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  VOID_EASING_ENTER,
  VOID_ENTER_TRANSLATE_Y,
  VOID_MOTION_ENTER,
} from '~/components/theme/motion';

/**
 * FadeIn — opacity 0→1, translateY 6→0, 150ms decelerate.
 */
export const FadeIn = ({ children }: { children: React.ReactNode }) => {
  const opacity = useSharedValue<number>(0);
  const translateY = useSharedValue<number>(VOID_ENTER_TRANSLATE_Y);

  useAnimatedReaction(
    () => opacity.value,
    (_, prev) => {
      'worklet';
      if (prev === null) {
        opacity.value = withTiming(1, { duration: VOID_MOTION_ENTER, easing: VOID_EASING_ENTER });
        translateY.value = withTiming(0, {
          duration: VOID_MOTION_ENTER,
          easing: VOID_EASING_ENTER,
        });
      }
    },
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};
