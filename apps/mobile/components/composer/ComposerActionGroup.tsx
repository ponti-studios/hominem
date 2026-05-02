import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { spacing } from '@hominem/ui/tokens';

import { makeStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

interface ComposerActionGroupProps {
  children: React.ReactNode;
  hasContent: boolean;
}

export function ComposerActionGroup({ children, hasContent }: ComposerActionGroupProps) {
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(hasContent ? 1 : 0, { duration: 180 });
  }, [hasContent, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 4 }],
  }));

  if (!hasContent) return null;

  return (
    <Animated.View
      entering={prefersReducedMotion ? undefined : FadeInDown.duration(160)}
      exiting={prefersReducedMotion ? undefined : FadeOutDown.duration(120)}
      style={animatedStyle}
    >
      <View style={styles.actionGroup}>{children}</View>
    </Animated.View>
  );
}

const useStyles = makeStyles(() => ({
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderRadius: 32,
    paddingHorizontal: 4,
  },
}));
