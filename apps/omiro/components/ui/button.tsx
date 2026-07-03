import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
  type PressableStateCallbackType,
} from 'react-native';

import {
  colors,
  componentSizes,
  fontSizes,
  fontWeights,
  radii,
  themeSpacing,
} from '~/components/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive-text';
  testID?: string;
}

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
  variant = 'primary',
  testID,
}: ButtonProps) {
  const resolvedStyles = useMemo(() => {
    const baseStyle = {
      paddingVertical: themeSpacing.md,
      paddingHorizontal: themeSpacing.lg,
      borderRadius: radii.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      alignSelf: 'stretch' as const,
      height: componentSizes.xl,
    };

    const variantStyles: Record<string, StyleProp<ViewStyle>> = {
      primary: {
        backgroundColor: colors.primary,
        borderWidth: 0,
      },
      secondary: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.foreground,
      },
      tertiary: {
        backgroundColor: 'transparent',
        borderWidth: 0,
      },
      'destructive-text': {
        backgroundColor: 'transparent',
        borderRadius: radii.md,
      },
    };

    const textColor = {
      primary: colors['primary-foreground'],
      secondary: colors.foreground,
      tertiary: colors.foreground,
      'destructive-text': colors.destructive,
    };

    return {
      container: [baseStyle, variantStyles[variant], disabled && styles.disabled],
      text: textColor[variant],
    };
  }, [disabled, variant]);

  const isInteractionDisabled = disabled || loading;

  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      resolvedStyles.container,
      loading && styles.loading,
      pressed && !isInteractionDisabled && styles.pressed,
    ],
    [isInteractionDisabled, loading, resolvedStyles.container],
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isInteractionDisabled}
      style={pressableStyle}
    >
      {loading ? (
        <ActivityIndicator color={resolvedStyles.text} size="small" />
      ) : (
        <Text
          style={[
            styles.text,
            size === 'sm' && styles.textSm,
            {
              color: resolvedStyles.text,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
  },
  textSm: {
    fontSize: fontSizes.footnote,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.5,
  },
  loading: {
    opacity: 0.7,
  },
});
