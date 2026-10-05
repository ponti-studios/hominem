import { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
  type PressableStateCallbackType,
} from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';

// shadcn's variant taxonomy (default/secondary/destructive/outline/ghost),
// mapped to the design constitution's tokens. `outline` is the one variant
// with a border -- the documented exception for a control that needs to
// read as tappable without a solid fill.
type ButtonVariant = 'primary' | 'ink' | 'secondary' | 'destructive' | 'outline' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  variant?: ButtonVariant;
  testID?: string;
}

const PRESSED_OPACITY = 0.7;
const LOADING_OPACITY = 0.7;
const DISABLED_OPACITY = 0.5;

export function Button({
  label,
  onPress,
  disabled = false,
  loading = false,
  size = 'md',
  style,
  variant = 'primary',
  testID,
}: ButtonProps) {
  const {
    primary,
    primaryForeground,
    muted,
    destructive,
    border: borderDefault,
    foreground: textPrimary,
    ink,
    inkForeground,
  } = useAppTheme().colors;

  const colorTokens = useMemo(
    () => ({
      primary,
      'primary-foreground': primaryForeground,
      muted,
      destructive,
      border: borderDefault,
      foreground: textPrimary,
      ink,
      'ink-foreground': inkForeground,
    }),
    [
      primary,
      primaryForeground,
      muted,
      destructive,
      borderDefault,
      textPrimary,
      ink,
      inkForeground,
    ],
  );

  const variantStyles = useMemo<
    Record<ButtonVariant, { backgroundColor?: string; borderWidth?: number; borderColor?: string }>
  >(
    () => ({
      primary: { backgroundColor: colorTokens.primary },
      ink: { backgroundColor: colorTokens.ink },
      secondary: { backgroundColor: colorTokens.muted },
      destructive: { backgroundColor: colorTokens.destructive },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colorTokens.border,
      },
      ghost: { backgroundColor: 'transparent' },
    }),
    [colorTokens],
  );

  const textColor = useMemo<Record<ButtonVariant, string>>(
    () => ({
      primary: colorTokens['primary-foreground'],
      ink: colorTokens['ink-foreground'],
      secondary: colorTokens.foreground,
      destructive: colorTokens['primary-foreground'],
      outline: colorTokens.foreground,
      ghost: colorTokens.foreground,
    }),
    [colorTokens],
  );

  const resolvedContainerStyle = useMemo(
    () => ({
      ...variantStyles[variant],
      ...(disabled ? { opacity: DISABLED_OPACITY } : {}),
    }),
    [variant, variantStyles, disabled],
  );

  const resolvedTextStyle = useMemo(
    () => ({
      color: textColor[variant],
      opacity: disabled ? 0.5 : 1,
    }),
    [variant, textColor, disabled],
  );

  const styles = useStyles((theme) => ({
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'stretch',
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.pill,
    },
    smallButton: { paddingHorizontal: 16, height: 36 },
    mediumButton: { paddingHorizontal: 20, height: 48 },
    largeButton: { paddingHorizontal: 24, height: 56 },
    smallText: { ...theme.textVariants.footnote, fontWeight: '700' },
    mediumText: { ...theme.textVariants.body, fontWeight: '700', lineHeight: 20 },
    largeText: { ...theme.textVariants.headline, fontWeight: '700', lineHeight: 22 },
  }));

  const isInteractionDisabled = disabled || loading;

  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      resolvedContainerStyle,
      style,
      loading && { opacity: LOADING_OPACITY },
      pressed && !isInteractionDisabled && { opacity: PRESSED_OPACITY },
    ],
    [isInteractionDisabled, loading, resolvedContainerStyle, style],
  );

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isInteractionDisabled}
      style={({ pressed }) => [
        styles.button,
        size === 'sm'
          ? styles.smallButton
          : size === 'lg'
            ? styles.largeButton
            : styles.mediumButton,
        ...pressableStyle({ pressed }),
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor[variant]} size="small" />
      ) : (
        <Text
          style={[
            size === 'sm' ? styles.smallText : size === 'lg' ? styles.largeText : styles.mediumText,
            resolvedTextStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
