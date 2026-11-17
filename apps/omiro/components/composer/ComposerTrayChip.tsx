import type { SFSymbol } from 'expo-symbols';
import { Text } from 'react-native';

import { fontFamilies, useAppTheme } from '~/components/theme';
import { Glass } from '~/components/ui/glass';
import AppIcon from '~/components/ui/icon';
import { PressableScale } from '~/components/ui/pressable-scale';

interface ComposerTrayChipProps {
  accessibilityLabel: string;
  disabled?: boolean;
  icon: SFSymbol;
  label: string;
  onPress: () => void;
  // Lime marks the AI action, the same accent the send button uses.
  tone?: 'default' | 'accent';
  testID?: string;
}

// One tray chip: a dark pill on the bar surface, 34pt tall like the design.
export function ComposerTrayChip({
  accessibilityLabel,
  disabled = false,
  icon,
  label,
  onPress,
  tone = 'default',
  testID,
}: ComposerTrayChipProps) {
  const { barForeground, primary } = useAppTheme().colors;
  const color = tone === 'accent' ? primary : barForeground;

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={{ top: 5, bottom: 5 }}
      onPress={onPress}
      testID={testID}
    >
      <Glass
        interactive
        style={{
          alignItems: 'center',
          flexDirection: 'row',
          gap: 6,
          height: 34,
          paddingHorizontal: 14,
        }}
      >
        <AppIcon name={icon} size={15} tintColor={color} />
        <Text
          numberOfLines={1}
          style={{ color, fontFamily: fontFamilies.sans, fontSize: 14, fontWeight: '500' }}
        >
          {label}
        </Text>
      </Glass>
    </PressableScale>
  );
}
