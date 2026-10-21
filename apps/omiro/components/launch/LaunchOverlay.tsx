import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthBrand } from '~/components/auth/AuthBrand';
import { LAUNCH_SCALE, launchTranslateY, loginBrandTop } from '~/components/auth/brand-layout';
import { useAppTheme } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';
import { setLaunchPhase } from '~/services/launch/launch-phase';

// The overlay first shows exactly what the native splash shows (the mascot, centred, on the app
// ground), so the hand-off from the native splash is invisible. It then waits for sign-in state to
// settle and either carries the mascot up to the login screen's brand position or, for a returning
// user, lifts it away over the inbox.
const MIN_HOLD_SIGNED_OUT_MS = 800;
const MIN_HOLD_SIGNED_IN_MS = 600;
const MIN_HOLD_REDUCED_MS = 300;
const FAILSAFE_MS = 4000;
const TRAVEL_MS = 900;
const LEAVE_MS = 450;
const REDUCED_MS = 200;

interface LaunchOverlayProps {
  // Sign-in state has settled, so `destination` is known.
  settled: boolean;
  destination: 'login' | 'app';
  // The mascot is on screen: the native splash can go.
  onShown: () => void;
}

export function LaunchOverlay({ settled, destination, onShown }: LaunchOverlayProps) {
  const { colors } = useAppTheme();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gone, setGone] = useState(false);
  const shownAtRef = useRef(0);
  const travel = useSharedValue(0);
  const exit = useSharedValue(0);
  const backdrop = useSharedValue(1);

  const handleLoad = useCallback(() => {
    shownAtRef.current = Date.now();
    setShown(true);
    onShown();
  }, [onShown]);

  useEffect(() => {
    if (leaving) {
      return;
    }
    const hold = reducedMotion
      ? MIN_HOLD_REDUCED_MS
      : destination === 'login'
        ? MIN_HOLD_SIGNED_OUT_MS
        : MIN_HOLD_SIGNED_IN_MS;
    const wait =
      settled && shown ? Math.max(0, hold - (Date.now() - shownAtRef.current)) : FAILSAFE_MS;
    const id = setTimeout(() => setLeaving(true), wait);
    return () => clearTimeout(id);
  }, [destination, leaving, reducedMotion, settled, shown]);

  useEffect(() => {
    if (!leaving) {
      return;
    }
    const toLogin = destination === 'login';
    const duration = reducedMotion ? REDUCED_MS : toLogin ? TRAVEL_MS : LEAVE_MS;
    const easing = Easing.bezier(0.22, 0.9, 0.24, 1);

    if (toLogin) {
      setLaunchPhase('travel');
      travel.set(withTiming(1, { duration, easing }));
      backdrop.set(withDelay(reducedMotion ? 0 : 150, withTiming(0, { duration: 300 })));
    } else {
      exit.set(withTiming(1, { duration, easing }));
      backdrop.set(withTiming(0, { duration }));
    }

    const id = setTimeout(() => {
      setLaunchPhase('done');
      setGone(true);
    }, duration + 40);
    return () => clearTimeout(id);
  }, [backdrop, destination, exit, leaving, reducedMotion, travel]);

  const startY = launchTranslateY({ insetTop: insets.top, windowHeight });
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));
  const groupStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [
      { translateY: interpolate(travel.value, [0, 1], [startY, 0]) },
      { scale: interpolate(travel.value, [0, 1], [LAUNCH_SCALE, 1]) * (1 + exit.value * 0.15) },
    ],
  }));

  if (gone) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={leaving && destination === 'login' ? 'none' : 'auto'}
      style={StyleSheet.absoluteFill}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, backdropStyle]}
      />
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.group, { top: loginBrandTop(insets.top) }, groupStyle]}
      >
        <AuthBrand animateWordmark floating={false} greet onLoad={handleLoad} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
