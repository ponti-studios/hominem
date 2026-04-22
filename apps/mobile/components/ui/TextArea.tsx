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
import { fontFamiliesNative, fontSizes, radii, spacing } from '~/components/theme/tokens';

import { Field } from './Field';
import type { TextAreaBaseProps } from './text-area.types';

interface TextAreaProps
  extends Omit<TextInputProps, 'accessibilityLabel' | 'editable' | 'multiline'>, TextAreaBaseProps {
  containerStyle?: StyleProp<ViewStyle>;
  editable?: boolean | undefined;
  style?: StyleProp<TextStyle>;
}

const useInputStyles = makeStyles((theme) => ({
  input: {
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors['border-default'],
    borderRadius: radii.md,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontFamily: fontFamiliesNative.mono,
    fontSize: fontSizes.sm,
    minHeight: 120,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
  },
  inputDisabled: {
    opacity: 0.5,
  },
  inputError: {
    borderColor: theme.colors.destructive,
  },
}));

const TextArea = React.forwardRef<TextInput, TextAreaProps>(function TextArea(
  { containerStyle, disabled, editable, error, helpText, label, placeholder, style, ...props },
  ref,
) {
  const styles = useInputStyles();
  const themeColors = useThemeColors();
  const isEditable = editable ?? !disabled;

  return (
    <Field containerStyle={containerStyle} error={error} helpText={helpText} label={label}>
      <TextInput
        ref={ref}
        editable={isEditable}
        multiline
        placeholder={placeholder ?? label}
        placeholderTextColor={themeColors['text-tertiary']}
        style={[
          styles.input,
          error ? styles.inputError : null,
          !isEditable ? styles.inputDisabled : null,
          style,
        ]}
        textAlignVertical="top"
        {...props}
      />
    </Field>
  );
});

export { TextArea };
export type { TextAreaProps };
