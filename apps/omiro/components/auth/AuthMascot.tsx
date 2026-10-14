import { Image } from 'expo-image';
import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useReducedMotion } from '~/hooks/use-reduced-motion';

const FLOAT_DISTANCE = 5;
const FLOAT_DURATION_MS = 1800;

export function AuthMascot() {
  const reducedMotion = useReducedMotion();
  const translateY = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(translateY);
    if (reducedMotion) {
      translateY.set(0);
      return;
    }

    translateY.set(
      withRepeat(
        withTiming(-FLOAT_DISTANCE, {
          duration: FLOAT_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );

    return () => cancelAnimation(translateY);
  }, [reducedMotion, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={animatedStyle}
    >
      <Image
        contentFit="contain"
        source={require('~/assets/images/omiro-auth-mascot.png')}
        style={{ width: 120, height: 126 }}
      />
    </Animated.View>
  );
}
