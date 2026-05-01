import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';
import { spacing } from '@hominem/ui/tokens';

import { makeStyles } from '~/components/theme';

interface ComposerActionGroupProps {
  hasContent: boolean;
  children: React.ReactNode;
}

export function ComposerActionGroup({ hasContent, children }: ComposerActionGroupProps) {
  const styles = useStyles();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(hasContent ? 1 : 0, { duration: 180 });
  }, [hasContent, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 6 }],
  }));

  return (
    <Animated.View style={animatedStyle} pointerEvents={hasContent ? 'auto' : 'none'}>
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
