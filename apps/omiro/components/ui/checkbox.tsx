import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useAppTheme } from '~/components/theme';

import AppIcon from './icon';

const SIZE = 30;

interface CheckboxProps {
  accessibilityLabel: string;
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}

// The chunky square checkbox: hollow outline when open, lime fill with a
// check when done. The pop on completion is a transform on the UI thread.
export function Checkbox({ accessibilityLabel, checked, onToggle, testID }: CheckboxProps) {
  const { lime, limeForeground, mutedForeground } = useAppTheme().colors;
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();
  const previous = useRef(checked);

  useEffect(() => {
    if (previous.current !== checked && !reducedMotion) {
      scale.set(withSequence(withTiming(0.82, { duration: 80 }), withSpring(1)));
    }
    previous.current = checked;
  }, [checked, reducedMotion, scale]);

  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={10}
      onPress={onToggle}
      testID={testID}
    >
      <Animated.View
        style={[
          styles.box,
          checked ? { backgroundColor: lime } : { borderColor: mutedForeground, borderWidth: 2.5 },
          animated,
        ]}
      >
        {checked ? <AppIcon name="checkmark" size={16} tintColor={limeForeground} /> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: 11,
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
});
