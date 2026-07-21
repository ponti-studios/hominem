import React, { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { colors, fontSizes, radii, themeSpacing } from '~/components/theme';

/**
 * The Input primitive (Primitives §2 of the design constitution): a bordered
 * box, always — the one visual signal that a region of the screen accepts
 * typing. Focus and error states swap the border color; nothing else about
 * the shape changes.
 */
interface InputProps extends TextInputProps {
  error?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { style, error = false, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.destructive
    : focused
      ? colors.accent
      : colors['border-default'];

  return (
    <TextInput
      ref={ref}
      placeholderTextColor={colors['text-tertiary']}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[styles.input, { borderColor, color: colors.foreground }, style]}
      {...props}
    />
  );
});

const styles = StyleSheet.create({
  input: {
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: fontSizes.md,
    minHeight: 44,
    paddingHorizontal: themeSpacing.lg,
    paddingVertical: themeSpacing.md,
  },
});
