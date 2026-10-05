import type { SFSymbol } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';

import AppIcon from './icon';

interface ChipProps {
  icon?: SFSymbol;
  label: string;
  onPress?: () => void;
  // 'ink' is the inverted, selected look; 'tonal' sits on a card or sheet.
  tone?: 'ink' | 'tonal' | 'outline' | 'card';
  testID?: string;
}

export function Chip({ icon, label, onPress, testID, tone = 'tonal' }: ChipProps) {
  const { background, border, card, foreground, ink, inkForeground } = useAppTheme().colors;
  const styles = useStyles((theme) => ({
    chip: {
      alignItems: 'center',
      borderCurve: 'continuous',
      borderRadius: theme.borderRadii.pill,
      flexDirection: 'row',
      gap: 6,
      minHeight: 36,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    label: { ...theme.textVariants.chip },
  }));
  const surface =
    tone === 'ink'
      ? { backgroundColor: ink }
      : tone === 'card'
        ? { backgroundColor: card }
        : tone === 'outline'
          ? { backgroundColor: 'transparent', borderColor: border, borderWidth: 1.5 }
          : { backgroundColor: background };
  const color = tone === 'ink' ? inkForeground : foreground;
  const content = (
    <>
      {icon ? <AppIcon name={icon} size={15} tintColor={color} /> : null}
      <Text numberOfLines={1} style={[styles.label, { color }]}>
        {label}
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View style={[styles.chip, surface]} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.chip, surface, pressed && { opacity: 0.7 }]}
      testID={testID}
    >
      {content}
    </Pressable>
  );
}
