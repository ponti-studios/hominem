import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { TextInput } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { makeStyles, useThemeColors } from '~/components/theme';

interface ComposerTextInputProps {
  inputRef: React.RefObject<TextInput | null>;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
}

const INPUT_MIN_H = spacing[6] + spacing[4];
const INPUT_MAX_H = spacing[6] * 9;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 220,
  mass: 0.7,
  overshootClamping: false,
} as const;

export function ComposerTextInput({
  inputRef,
  value,
  onChangeText,
  placeholder,
  testID,
}: ComposerTextInputProps) {
  const themeColors = useThemeColors();
  const styles = useStyles();
  const animatedH = useSharedValue(INPUT_MIN_H);

  React.useEffect(() => {
    if (value.length === 0) {
      animatedH.value = withSpring(INPUT_MIN_H, SPRING_CONFIG);
    }
  }, [animatedH, value.length]);

  const inputContainerStyle = useAnimatedStyle(() => ({
    flex: 1,
    maxHeight: INPUT_MAX_H,
    minHeight: animatedH.value,
    minWidth: 0,
  }));

  return (
    <Animated.View style={[inputContainerStyle]}>
      <TextInput
        ref={inputRef}
        multiline
        scrollEnabled={false}
        value={value}
        onChangeText={onChangeText}
        onContentSizeChange={(e) => {
          const height = e.nativeEvent.contentSize.height;
          const clamped = Math.min(Math.max(height, INPUT_MIN_H), INPUT_MAX_H);
          animatedH.value = withSpring(clamped, SPRING_CONFIG);
        }}
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
    letterSpacing: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    width: '100%',
  },
}));
