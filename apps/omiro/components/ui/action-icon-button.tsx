import type { SFSymbol } from 'expo-symbols';

import { useAppTheme } from '~/components/theme';
import { IconButton } from '~/components/ui';
import AppIcon from '~/components/ui/icon';

export function ActionIconButton({
  disabled = false,
  icon,
  isDestructive = false,
  onPress,
}: {
  disabled?: boolean;
  icon: SFSymbol;
  isDestructive?: boolean;
  onPress: () => void;
}) {
  const { destructive, tertiary } = useAppTheme().colors;
  return (
    <IconButton
      accessibilityLabel={icon}
      disabled={disabled}
      onPress={onPress}
      size="md"
      style={{ height: 36, width: 36 }}
      variant="plain"
    >
      <AppIcon name={icon} size={18} tintColor={isDestructive ? destructive : tertiary} />
    </IconButton>
  );
}
