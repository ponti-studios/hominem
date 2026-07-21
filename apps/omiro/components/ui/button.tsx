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

/**
 * shadcn's variant taxonomy (default/secondary/destructive/outline/ghost),
 * translated to the design constitution's tokens. `outline` is the one
 * variant with a border — the constitution's documented exception for a
 * control that needs to read as tappable without a solid fill.
 */
type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md';
  variant?: ButtonVariant;
  testID?: string;
}

const COMPACT_HEIGHT = 36;

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
      height: size === 'sm' ? COMPACT_HEIGHT : componentSizes.xl,
    };

    const variantStyles: Record<ButtonVariant, StyleProp<ViewStyle>> = {
      primary: {
        backgroundColor: colors.primary,
      },
      secondary: {
        backgroundColor: colors.muted,
      },
      destructive: {
        backgroundColor: colors.destructive,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors['border-default'],
      },
      ghost: {
        backgroundColor: 'transparent',
      },
    };

    const textColor: Record<ButtonVariant, string> = {
      primary: colors['primary-foreground'],
      secondary: colors.foreground,
      destructive: colors['primary-foreground'],
      outline: colors.foreground,
      ghost: colors.foreground,
    };

    return {
      container: [baseStyle, variantStyles[variant], disabled && styles.disabled],
      text: textColor[variant],
    };
  }, [disabled, size, variant]);

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
