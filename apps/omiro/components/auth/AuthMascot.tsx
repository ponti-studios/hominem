import { Image } from 'expo-image';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';

import { LOGIN_MASCOT_HEIGHT, LOGIN_MASCOT_WIDTH } from './brand-layout';

const FLOAT_DISTANCE = 5;
const FLOAT_DURATION_MS = 1800;
const LEAN_DEGREES = -7;

interface AuthMascotProps {
  // Gently bob up and down. The launch overlay turns this off: the native splash it continues from is
  // a still image.
  floating?: boolean;
  // Do the little hello bounce once on mount.
  greet?: boolean;
  // Tilt toward the form (the code step).
  leaningIn?: boolean;
  // Counters: each increment plays the reaction once. They start at 0 and the first value is ignored.
  nod?: number;
  hop?: number;
  onLoad?: () => void;
}

export function AuthMascot({
  floating = true,
  greet = false,
  leaningIn = false,
  nod = 0,
  hop = 0,
  onLoad,
}: AuthMascotProps) {
  const reducedMotion = useReducedMotion();
  const floatY = useSharedValue(0);
  const greetScale = useSharedValue(1);
  const greetY = useSharedValue(0);
  const nodY = useSharedValue(0);
  const hopY = useSharedValue(0);
  const lean = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(floatY);
    if (!floating || reducedMotion) {
      floatY.set(0);
      return;
    }

    floatY.set(
      withRepeat(
        withTiming(-FLOAT_DISTANCE, {
          duration: FLOAT_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );

    return () => cancelAnimation(floatY);
  }, [floatY, floating, reducedMotion]);

  useEffect(() => {
    if (!greet || reducedMotion) {
      return;
    }
    greetScale.set(
      withSequence(
        withTiming(0.96, { duration: 0 }),
        withTiming(1.07, { duration: 300, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 140 }),
      ),
    );
    greetY.set(
      withSequence(
        withTiming(-6, { duration: 300, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 8, stiffness: 140 }),
      ),
    );
  }, [greet, greetScale, greetY, reducedMotion]);

  useEffect(() => {
    if (nod === 0 || reducedMotion) {
      return;
    }
    nodY.set(
      withSequence(
        withTiming(3, { duration: 80, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 180, easing: Easing.out(Easing.quad) }),
      ),
    );
  }, [nod, nodY, reducedMotion]);

  useEffect(() => {
    if (hop === 0 || reducedMotion) {
      return;
    }
    hopY.set(
      withSequence(
        withTiming(2, { duration: 80 }),
        withTiming(-18, { duration: 220, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 9, stiffness: 170 }),
      ),
    );
  }, [hop, hopY, reducedMotion]);

  useEffect(() => {
    lean.set(reducedMotion ? 0 : withSpring(leaningIn ? LEAN_DEGREES : 0, { damping: 12 }));
  }, [lean, leaningIn, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value + greetY.value + nodY.value + hopY.value },
      { scale: greetScale.value },
      { rotate: `${lean.value}deg` },
    ],
  }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={animatedStyle}
    >
      <Image
        contentFit="contain"
        onLoad={onLoad}
        source={require('~/assets/images/omiro-auth-mascot.png')}
        style={{ width: LOGIN_MASCOT_WIDTH, height: LOGIN_MASCOT_HEIGHT }}
      />
    </Animated.View>
  );
}
