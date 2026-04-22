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
import type { TextFieldBaseProps, TextFieldType } from './text-field.types';

interface TextFieldProps
  extends Omit<TextInputProps, 'accessibilityLabel' | 'editable'>, TextFieldBaseProps {
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  editable?: boolean | undefined;
  type?: TextFieldType | undefined;
}

const useInputStyles = makeStyles((theme) => ({
  input: {
    backgroundColor: theme.colors.muted,
    borderColor: theme.colors['border-default'],
    borderCurve: 'continuous',
    borderRadius: radii.sm,
    borderWidth: 1,
    color: theme.colors.foreground,
    fontFamily: fontFamiliesNative.primary,
    fontSize: fontSizes.body,
    minHeight: 44,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
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
    style,
    type = 'text',
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
          styles.input,
          error ? styles.inputError : null,
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
