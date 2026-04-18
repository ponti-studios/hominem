import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Text, theme } from '~/components/theme';

import { styles } from '../../app/(protected)/(tabs)/settings/styles';

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface PersonSaveIconProps {
  feedback: 'idle' | 'success' | 'error';
}

export function PersonSaveIcon({ feedback }: PersonSaveIconProps) {
  const progress = useSharedValue(0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    if (feedback === 'idle') {
      progress.value = 0;
      shakeX.value = 0;
      return;
    }

    progress.value = 0;

    if (feedback === 'success') {
      progress.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      );
      return;
    }

    shakeX.value = withSequence(
      withTiming(-4, { duration: 40 }),
      withTiming(4, { duration: 40 }),
      withTiming(-3, { duration: 36 }),
      withTiming(3, { duration: 36 }),
      withTiming(-2, { duration: 32 }),
      withTiming(2, { duration: 32 }),
      withTiming(0, { duration: 32 }),
    );
    progress.value = withSequence(
      withTiming(1, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 220, easing: Easing.inOut(Easing.quad) }),
    );
  }, [feedback, progress, shakeX]);

  const animatedProps = useAnimatedProps(() => {
    const targetColor =
      feedback === 'success'
        ? theme.colors.success
        : feedback === 'error'
          ? theme.colors.destructive
          : theme.colors['icon-primary'];

    return {
      tintColor: interpolateColor(
        progress.value,
        [0, 1],
        [theme.colors['icon-primary'], targetColor],
      ),
    };
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  return (
    <Animated.View
      style={[styles.rowIconWrap, { backgroundColor: theme.colors['bg-elevated'] }, animatedStyle]}
    >
      <AnimatedImage
        source="sf:person.crop.circle"
        style={styles.rowIcon}
        contentFit="contain"
        animatedProps={animatedProps}
      />
    </Animated.View>
  );
}
