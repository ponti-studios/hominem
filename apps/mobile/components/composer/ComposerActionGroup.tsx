import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { makeStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

interface ComposerActionGroupProps {
  children: React.ReactNode;
  hasContent: boolean;
}

export function ComposerActionGroup({ children, hasContent }: ComposerActionGroupProps) {
  const styles = useStyles();
  const prefersReducedMotion = useReducedMotion();

  if (!hasContent) return null;

  return (
    <Animated.View
      entering={prefersReducedMotion ? undefined : FadeInDown.duration(160)}
      exiting={prefersReducedMotion ? undefined : FadeOutDown.duration(120)}
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
