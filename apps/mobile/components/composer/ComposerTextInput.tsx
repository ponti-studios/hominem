import React from 'react';
import { TextInput } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

import { makeStyles, useThemeColors } from '~/components/theme';

interface ComposerTextInputProps {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
  onContentSizeChange: (h: number) => void;
  placeholder: string;
  testID?: string;
  inputStyle: AnimatedStyle<ViewStyle>;
}

export function ComposerTextInput({
  inputRef,
  value,
  onChangeText,
  onContentSizeChange,
  placeholder,
  testID,
  inputStyle,
}: ComposerTextInputProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();

  return (
    <Animated.View style={inputStyle}>
      <TextInput
        ref={inputRef}
        multiline
        scrollEnabled={false}
        value={value}
        onChangeText={onChangeText}
        onContentSizeChange={(e) => onContentSizeChange(e.nativeEvent.contentSize.height)}
        placeholder={placeholder}
        placeholderTextColor={themeColors['text-tertiary']}
        cursorColor={themeColors.accent}
        selectionColor={themeColors.accent}
        style={styles.input}
        testID={testID}
      />
    </Animated.View>
  );
}

const useStyles = makeStyles((theme) => ({
  input: {
    color: theme.colors.foreground,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
}));
