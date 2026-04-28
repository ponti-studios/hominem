import type { SFSymbol, SymbolViewProps } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';
import { StyleSheet } from 'react-native';

import { useThemeColors } from '~/components/theme/theme';

type IconProps = Omit<SymbolViewProps, 'name' | 'size' | 'tintColor'> & {
  name: SFSymbol;
  size?: number | undefined;
  tintColor?: ColorValue | undefined;
};

const AppIcon = ({ name, size = 24, style, tintColor, ...rest }: IconProps) => {
  const themeColors = useThemeColors();
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={tintColor ?? themeColors['icon-primary']}
      style={[styles.icon, style, { height: size, width: size }]}
      {...rest}
    />
  );
};

const styles = StyleSheet.create({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});

export default AppIcon;
export type { IconProps };
