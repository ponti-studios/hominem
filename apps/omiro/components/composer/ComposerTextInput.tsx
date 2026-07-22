import React from 'react';
import { TextInput, View } from 'react-native';

import { makeStyles, useThemeColors } from '~/components/theme';
import { spacing } from '~/components/theme/ponti-tokens';

interface ComposerTextInputProps {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
}

const INPUT_MIN_H = spacing[6] + spacing[4];
const INPUT_MAX_H = spacing[6] * 9;

export function ComposerTextInput({
  inputRef,
  value,
  onChangeText,
  placeholder,
  testID,
}: ComposerTextInputProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  return (
    <View style={styles.inputContainer}>
      <TextInput
        ref={inputRef}
        multiline
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors['text-tertiary']}
        cursorColor={themeColors.accent}
        selectionColor={themeColors.accent}
        style={styles.input}
        testID={testID}
      />
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  inputContainer: {
    flexShrink: 1,
    maxHeight: INPUT_MAX_H,
    minWidth: 0,
  },
  input: {
    color: theme.colors['text-primary'],
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    minHeight: INPUT_MIN_H,
    paddingVertical: 8,
    width: '100%',
  },
}));
