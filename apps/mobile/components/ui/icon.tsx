import { Host as SwiftUIHost, Image as SwiftUIImage } from '@expo/ui/swift-ui';
import type { SFSymbol } from 'expo-symbols';

import { useThemeColors } from '~/components/theme/theme';

interface IconProps {
  color?: string | undefined;
  name: SFSymbol;
  size?: number | undefined;
}

const AppIcon = ({ color, name, size = 24 }: IconProps) => {
  const themeColors = useThemeColors();
  return (
    <SwiftUIHost matchContents>
      <SwiftUIImage systemName={name} size={size} color={color ?? themeColors['icon-primary']} />
    </SwiftUIHost>
  );
};

export default AppIcon;
export type { IconProps };
