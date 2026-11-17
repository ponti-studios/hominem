import { forwardRef, useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
  type TextInputInstance,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { fontFamilies, useAppTheme, useStyles } from '~/components/theme';
import { useReducedMotion } from '~/hooks/use-reduced-motion';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

interface TextFieldProps extends TextInputProps {
  focusBorder?: boolean;
  hasError?: boolean;
}

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { style, focusBorder = true, hasError = false, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const reducedMotion = useReducedMotion();
  const { colors } = useAppTheme();
  const styles = useStyles((theme) => ({
    input: {
      minHeight: 50,
      paddingHorizontal: 16,
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.lg,
      fontFamily: fontFamilies.sans,
      fontSize: 18,
      color: theme.colors.foreground,
    } satisfies TextStyle & ViewStyle,
  }));

  const focusStyle = useAnimatedStyle(() => {
    if (!focusBorder) {
      return { borderColor: 'transparent', borderWidth: 0 };
    }

    return {
      borderColor: hasError ? colors.destructive : focused ? colors.ring : colors.border,
      borderWidth: withTiming(focused || hasError ? 1.5 : 1, {
        duration: reducedMotion ? 0 : 150,
      }),
    };
  });

  return (
    <AnimatedTextInput
      {...props}
      ref={ref}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      placeholderTextColor={props.placeholderTextColor ?? colors.mutedForeground}
      style={[styles.input, focusStyle, style]}
    />
  );
});
