import { durations } from '@hominem/ui/tokens';
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { theme } from '~/components/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 4,
}) => {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, {
        duration: durations.breezy,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [shimmerValue]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmerValue.value * 0.5,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
        } as any,
        animatedStyle,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.colors['bg-elevated'],
  },
});

export default Skeleton;
