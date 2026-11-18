import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { nativeMotionSprings, PRESS_SCALE } from '~/services/motion/native-motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const DISABLED_OPACITY = 0.45;
const REDUCED_MOTION_PRESSED_OPACITY = 0.7;

export interface PressableScaleProps extends Omit<PressableProps, 'children' | 'style'> {
  children?: ReactNode;
  // A light tap when the press commits. For commits (send, complete), not
  // every touch.
  haptic?: boolean;
  scale?: number;
  style?: StyleProp<ViewStyle>;
}

// The press feedback every control is built on: sink under the finger, spring
// back on release. Under Reduce Motion it dims instead of moving.
export function PressableScale({
  children,
  disabled,
  haptic = false,
  onPress,
  onPressIn,
  onPressOut,
  scale = PRESS_SCALE,
  style,
  ...props
}: PressableScaleProps) {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() =>
    reducedMotion
      ? { opacity: 1 - pressed.value * (1 - REDUCED_MOTION_PRESSED_OPACITY) }
      : { transform: [{ scale: 1 - pressed.value * (1 - scale) }] },
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={(event) => {
        if (haptic) {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPress?.(event);
      }}
      onPressIn={(event) => {
        pressed.set(withSpring(1, nativeMotionSprings.snappy));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.set(withSpring(0, nativeMotionSprings.snappy));
        onPressOut?.(event);
      }}
      style={[style, animatedStyle, disabled ? { opacity: DISABLED_OPACITY } : null]}
    >
      {children}
    </AnimatedPressable>
  );
}
