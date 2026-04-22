import { SymbolView, type SFSymbol } from 'expo-symbols';

import { useThemeColors } from '~/components/theme/theme';

interface IconProps {
  color?: string | undefined;
  name: SFSymbol;
  size?: number | undefined;
}

const AppIcon = ({ color, name, size = 24 }: IconProps) => {
  const themeColors = useThemeColors();
  return <SymbolView name={name} size={size} tintColor={color ?? themeColors['icon-primary']} />;
};

export default AppIcon;
export type { IconProps };
