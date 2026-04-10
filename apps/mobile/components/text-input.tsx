import { useId } from 'react';
import {
  TextInput as NativeTextInput,
  View,
  type StyleProp,
  type TextInputProps as NativeTextInputProps,
  type TextStyle,
} from 'react-native';

import { Text } from '~/components/theme';
import theme from '~/components/theme/theme';

interface TextInputProps extends Omit<NativeTextInputProps, 'style'> {
  id?: string;
  label?: string;
  error?: string;
  helpText?: string;
  style?: StyleProp<TextStyle>;
}

export default function TextInput({
  id,
  label,
  error,
  helpText,
  style,
  editable = true,
  ...props
}: TextInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputStyle: TextStyle = {
    borderWidth: 1,
    borderColor: error ? theme.colors.destructive : theme.colors['border-default'],
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.foreground,
    backgroundColor: theme.colors.background,
  };

  return (
    <View style={{ gap: 6 }}>
      {label ? <Text nativeID={`${inputId}-label`}>{label}</Text> : null}
      <NativeTextInput
        {...props}
        accessibilityLabel={label}
        editable={editable}
        placeholderTextColor={theme.colors['text-tertiary']}
        style={[inputStyle, style]}
      />
      {error ? <Text style={{ color: theme.colors.destructive, fontSize: 12 }}>{error}</Text> : null}
      {!error && helpText ? <Text style={{ color: theme.colors['text-secondary'], fontSize: 12 }}>{helpText}</Text> : null}
    </View>
  );
}
