import * as React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useThemeColors } from '~/components/theme/theme';
import {
  fontFamiliesNative,
  fontSizes,
  fontWeights,
  radii,
  spacing,
} from '~/components/theme/tokens';

import type { ButtonBaseProps, ButtonSize, ButtonVariant } from './button.types';

const sizeStyles = StyleSheet.create<Record<ButtonSize, ViewStyle>>({
  default: {
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  sm: {
    minHeight: 36,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  md: {
    minHeight: 44,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  lg: {
    minHeight: 48,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
  },
  xs: {
    minHeight: 28,
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  icon: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 44,
  },
  'icon-xs': {
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 28,
  },
  'icon-sm': {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 36,
  },
  'icon-lg': {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 0,
    width: 48,
  },
});

const baseStyles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    columnGap: spacing[2],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: Math.round(fontSizes.sm * 1.4),
  },
  loader: {
    marginLeft: spacing[1],
  },
});

type NativeButtonProps = PressableProps &
  ButtonBaseProps & {
    children?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
  };

function Button({
  children,
  disabled,
  isLoading = false,
  size = 'md',
  style,
  textStyle,
  title,
  variant = 'primary',
  ...props
}: NativeButtonProps) {
  const themeColors = useThemeColors();
  const content = children ?? title;
  const isDisabled = disabled || isLoading;

  const variantBg: Record<ButtonVariant, ViewStyle> = {
    default: {
      backgroundColor: themeColors.secondary,
      borderColor: themeColors['border-default'],
      borderWidth: 1,
    },
    primary: { backgroundColor: themeColors.black, borderColor: themeColors.black, borderWidth: 1 },
    destructive: {
      backgroundColor: themeColors.destructive,
      borderColor: themeColors.destructive,
      borderWidth: 1,
    },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent', borderWidth: 1 },
    link: {
      backgroundColor: 'transparent',
      borderColor: 'transparent',
      borderWidth: 0,
      minHeight: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    outline: {
      backgroundColor: themeColors.background,
      borderColor: themeColors['border-default'],
      borderWidth: 1,
    },
    secondary: {
      backgroundColor: themeColors.secondary,
      borderColor: themeColors['border-default'],
      borderWidth: 1,
    },
  };

  const variantText: Record<ButtonVariant, TextStyle> = {
    default: { color: themeColors['text-primary'] },
    primary: { color: themeColors.white },
    destructive: { color: themeColors['destructive-foreground'] },
    ghost: { color: themeColors['text-primary'] },
    link: { color: themeColors.accent, textDecorationLine: 'underline' },
    outline: { color: themeColors['text-primary'] },
    secondary: { color: themeColors['text-primary'] },
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        baseStyles.button,
        sizeStyles[size],
        variantBg[variant],
        pressed && !isDisabled ? { opacity: 0.85 } : null,
        isDisabled ? baseStyles.disabled : null,
        style,
      ]}
      {...props}
    >
      {typeof content === 'string' || typeof content === 'number' ? (
        <Text style={[baseStyles.label, variantText[variant], textStyle]}>{content}</Text>
      ) : (
        content
      )}
      {isLoading ? (
        <ActivityIndicator
          color={variantText[variant].color as string}
          size="small"
          style={baseStyles.loader}
        />
      ) : null}
    </Pressable>
  );
}

export { Button };
export type { NativeButtonProps as ButtonProps };
