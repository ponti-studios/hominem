import { SymbolView, type SFSymbol } from 'expo-symbols';

import { theme } from '~/components/theme';
import { appleSymbolMap } from './apple-symbols';

type IconName = keyof typeof appleSymbolMap;

interface IconProps {
  color?: string | undefined;
  name: IconName;
  size?: number | undefined;
}

const AppIcon = ({ color, name, size = 24 }: IconProps) => {
  return (
    <SymbolView
      name={appleSymbolMap[name]}
      size={size}
      tintColor={color ?? theme.colors['icon-primary']}
    />
  );
};

export default AppIcon;
export type { IconName, IconProps };
