import type { SFSymbol } from 'expo-symbols';
import { Text, View } from 'react-native';

import { useAppTheme, useStyles } from '~/components/theme';

import { Glass } from './glass';
import AppIcon from './icon';
import { PressableScale } from './pressable-scale';

interface ChipProps {
  icon?: SFSymbol;
  label: string;
  onPress?: () => void;
  // 'ink' is the inverted, selected look; 'tonal' sits on a card or sheet;
  // 'glass' floats over content.
  tone?: 'ink' | 'tonal' | 'outline' | 'card' | 'glass';
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
          : tone === 'glass'
            ? null
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

  const body =
    tone === 'glass' ? (
      <Glass
        interactive={Boolean(onPress)}
        style={styles.chip}
        testID={onPress ? undefined : testID}
      >
        {content}
      </Glass>
    ) : (
      content
    );

  if (!onPress) {
    return tone === 'glass' ? (
      body
    ) : (
      <View style={[styles.chip, surface]} testID={testID}>
        {content}
      </View>
    );
  }
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={tone === 'glass' ? undefined : [styles.chip, surface]}
      testID={testID}
    >
      {body}
    </PressableScale>
  );
}
