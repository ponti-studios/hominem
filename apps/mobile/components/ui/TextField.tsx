import * as React from 'react';
import {
  TextInput,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { makeStyles } from '~/components/theme';
import { useThemeColors } from '~/components/theme/theme';
import {
  fontFamiliesNative,
  fontSizes,
  fontWeights,
  radii,
  spacing,
} from '~/components/theme';

import { Field } from './Field';
import type { TextFieldBaseProps, TextFieldType } from './text-field.types';

export type TextFieldSize = 'sm' | 'md' | 'lg';
export type TextFieldVariant = 'default' | 'plain';

interface TextFieldProps extends Omit<TextInputProps, 'editable'>, TextFieldBaseProps {
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  editable?: boolean | undefined;
  size?: TextFieldSize | undefined;
  type?: TextFieldType | undefined;
  variant?: TextFieldVariant | undefined;
}

const useInputStyles = makeStyles((theme) => ({
  // ── default variant (bordered form field) ───────────────────────────────────
  defaultBase: {
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors['border-default'],
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontFamily: fontFamiliesNative.primary,
    paddingHorizontal: spacing[3],
  },
  defaultSm: {
    fontSize: fontSizes.footnote,
    lineHeight: 18,
    minHeight: 36,
    paddingVertical: spacing[1],
  },
  defaultMd: {
    fontSize: fontSizes.body,
    lineHeight: 24,
    minHeight: 44,
    paddingVertical: spacing[2],
  },
  defaultLg: {
    fontSize: fontSizes.lg,
    lineHeight: 28,
    minHeight: 52,
    paddingVertical: spacing[3],
  },

  // ── plain variant (bare inline, matches notes editor) ────────────────────────
  plainBase: {
    color: theme.colors.foreground,
    fontFamily: fontFamiliesNative.primary,
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  plainSm: {
    fontSize: fontSizes.footnote,
    fontWeight: fontWeights.regular,
    letterSpacing: 0,
    lineHeight: 18,
  },
  plainMd: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    letterSpacing: -0.1,
    lineHeight: 26,
  },
  plainLg: {
    fontSize: fontSizes.display,
    fontWeight: fontWeights.bold,
    letterSpacing: -0.6,
    lineHeight: 34,
  },

  // ── state modifiers ──────────────────────────────────────────────────────────
  inputDisabled: {
    opacity: 0.5,
  },
  inputError: {
    borderColor: theme.colors.destructive,
  },
}));

const TextField = React.forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    containerStyle,
    disabled,
    editable,
    error,
    helpText,
    id,
    label,
    placeholder,
    size = 'md',
    style,
    type = 'text',
    variant = 'default',
    ...props
  },
  ref,
) {
  const styles = useInputStyles();
  const themeColors = useThemeColors();
  const isEditable = editable ?? !disabled;
  const keyboardType =
    type === 'email' ? 'email-address' : type === 'search' ? 'web-search' : 'default';
  const secureTextEntry = type === 'password';

  const sizeStyle =
    variant === 'plain'
      ? size === 'sm'
        ? styles.plainSm
        : size === 'lg'
          ? styles.plainLg
          : styles.plainMd
      : size === 'sm'
        ? styles.defaultSm
        : size === 'lg'
          ? styles.defaultLg
          : styles.defaultMd;

  const baseStyle = variant === 'plain' ? styles.plainBase : styles.defaultBase;

  return (
    <Field containerStyle={containerStyle} error={error} helpText={helpText} id={id} label={label}>
      <TextInput
        ref={ref}
        editable={isEditable}
        keyboardType={keyboardType}
        placeholder={placeholder ?? label}
        placeholderTextColor={themeColors['text-tertiary']}
        secureTextEntry={secureTextEntry}
        style={[
          baseStyle,
          sizeStyle,
          error && variant === 'default' ? styles.inputError : null,
          !isEditable ? styles.inputDisabled : null,
          style,
        ]}
        {...props}
      />
    </Field>
  );
});

export { TextField };
export type { TextFieldProps };
