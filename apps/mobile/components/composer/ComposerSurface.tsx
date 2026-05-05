import { radii, spacing } from '@hominem/ui/tokens';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { makeStyles } from '~/components/theme';

interface ComposerSurfaceProps {
  accessory?: React.ReactNode;
  actions?: React.ReactNode;
  input: React.ReactNode;
  leadingAction: React.ReactNode;
  testID?: string;
}

export function ComposerSurface({
  accessory,
  actions,
  input,
  leadingAction,
  testID,
}: ComposerSurfaceProps) {
  const styles = useStyles();
  const { isKeyboardVisible } = useComposerContext();
  const keyboardOpen = useSharedValue(isKeyboardVisible ? 1 : 0);

  useEffect(() => {
    keyboardOpen.value = withTiming(isKeyboardVisible ? 1 : 0, { duration: 250 });
  }, [isKeyboardVisible, keyboardOpen]);

  const animatedContentStyle = useAnimatedStyle(() => ({
    paddingBottom: spacing[6] - (spacing[6] - spacing[3]) * keyboardOpen.value,
  }));

  return (
    <Animated.View style={[styles.surface, styles.content, animatedContentStyle]} testID={testID}>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      {input}
      <View style={[styles.actionRow, actions ? null : styles.actionRowCompact]}>
        <View style={styles.leadingActionSlot}>{leadingAction}</View>
        <View style={styles.actionSlot}>{actions}</View>
      </View>
    </Animated.View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    backgroundColor: theme.colors['white'],
    borderColor: theme.colors['border-subtle'],
    borderLeftWidth: 1,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    width: '100%',
  },
  content: {
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    paddingTop: spacing[2],
  },
  accessory: {
    gap: spacing[2],
    width: '100%',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    minHeight: spacing[5],
    width: '100%',
  },
  actionRowCompact: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 0,
    minHeight: 0,
    width: 'auto',
  },
  leadingActionSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSlot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}));
