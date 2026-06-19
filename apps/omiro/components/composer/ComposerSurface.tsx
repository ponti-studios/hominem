import { radii, spacing } from '@hominem/ui/tokens';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useComposerContext } from '~/components/composer/ComposerContext';
import { makeStyles, shadowsNative } from '~/components/theme';

interface ComposerSurfaceProps {
  accessory?: React.ReactNode;
  inlinePanel?: React.ReactNode;
  actions?: React.ReactNode;
  input: React.ReactNode;
  leadingAction: React.ReactNode;
  testID?: string;
}

export function ComposerSurface({
  accessory,
  inlinePanel,
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
      <View style={styles.inputRow}>
        <View style={styles.leadingActionSlot}>{leadingAction}</View>
        <View style={styles.inputSlot}>{input}</View>
      </View>
      {inlinePanel ? <View style={styles.inlinePanel}>{inlinePanel}</View> : null}
      {actions ? (
        <View style={styles.actionRow}>
          <View style={styles.actionSlot}>{actions}</View>
        </View>
      ) : null}
    </Animated.View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    ...shadowsNative.low,
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors['border-default'],
    borderLeftWidth: 1,
    borderRadius: radii.xl,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    elevation: 6,
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
  inlinePanel: {
    marginTop: spacing[1],
    width: '100%',
  },
  inputRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing[2],
    width: '100%',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    minHeight: spacing[6],
    width: '100%',
  },
  leadingActionSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: spacing[1],
  },
  inputSlot: {
    flex: 1,
  },
  actionSlot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}));
