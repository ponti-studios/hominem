import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useHaptics } from '~/hooks/useHaptics';
import theme from '~/components/theme/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive' | 'default';
type ButtonSize = 'xs' | 'sm' | 'md' | 'default';

interface ButtonProps {
  title?: string;
  children?: ReactNode;
  onPress?: () => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  testID?: string;
  accessibilityLabel?: string;
}

function resolveContainerStyle(variant: ButtonVariant): ViewStyle {
  switch (variant) {
    case 'link':
      return { paddingHorizontal: 0, paddingVertical: 4, backgroundColor: 'transparent' };
    case 'outline':
      return {
        backgroundColor: theme.colors['bg-base'],
        borderWidth: 1,
        borderColor: theme.colors['border-default'],
      };
    case 'ghost':
      return { backgroundColor: 'transparent' };
    case 'secondary':
      return {
        backgroundColor: theme.colors['bg-elevated'],
        borderWidth: 1,
        borderColor: theme.colors['border-subtle'],
      };
    case 'destructive':
      return { backgroundColor: theme.colors.destructive };
    case 'default':
    case 'primary':
    default:
      return { backgroundColor: theme.colors.foreground };
  }
}

function resolveTextStyle(variant: ButtonVariant): TextStyle {
  switch (variant) {
    case 'link':
      return {
        color: theme.colors['text-secondary'],
        fontSize: 12,
        fontWeight: '600',
        textDecorationLine: 'underline',
      };
    case 'outline':
    case 'ghost':
    case 'secondary':
      return { color: theme.colors.foreground, fontSize: 14, fontWeight: '600' };
    case 'destructive':
      return { color: theme.colors['destructive-foreground'], fontSize: 14, fontWeight: '600' };
    case 'default':
    case 'primary':
    default:
      return { color: theme.colors.background, fontSize: 14, fontWeight: '600' };
  }
}

const sizeStyles: Record<ButtonSize, { minHeight: number; paddingHorizontal: number; paddingVertical: number }> = {
  xs: { minHeight: 28, paddingHorizontal: 8, paddingVertical: 4 },
  sm: { minHeight: 34, paddingHorizontal: 12, paddingVertical: 6 },
  md: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
  default: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 10 },
};

export function Button({
  title,
  children,
  onPress,
  disabled = false,
  isLoading = false,
  variant = 'primary',
  size = 'md',
  style,
  textStyle,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const { impact } = useHaptics();
  const sizing = sizeStyles[size];

  const handlePress = () => {
    void impact();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || isLoading}
      onPress={handlePress}
      testID={testID}
      style={({ pressed }) => [
        {
          borderRadius: 999,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled || isLoading ? 0.5 : pressed ? 0.85 : 1,
          ...sizing,
        },
        resolveContainerStyle(variant),
        style,
      ]}
    >
      {isLoading ? (
        <ActivityIndicator
          color={
            variant === 'link' || variant === 'outline' || variant === 'ghost' || variant === 'secondary'
              ? theme.colors['text-secondary']
              : theme.colors.background
          }
        />
      ) : typeof children === 'string' || title ? (
        <Text style={[resolveTextStyle(variant), textStyle]}>{children ?? title}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
