import type { SFSymbol, SymbolViewProps } from 'expo-symbols';
import { SymbolView } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { componentSizes, makeStyles, useThemeColors } from '~/components/theme';

type IconProps = Omit<SymbolViewProps, 'name' | 'size' | 'tintColor'> & {
  name: SFSymbol;
  size?: number | undefined;
  tintColor?: ColorValue | undefined;
};

const useStyles = makeStyles(() => ({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
}));

const AppIcon = ({ name, size = componentSizes.md, style, tintColor, ...rest }: IconProps) => {
  const themeColors = useThemeColors();
  const styles = useStyles();
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={tintColor ?? themeColors['text-primary']}
      style={[styles.icon, style, { height: size, width: size }]}
      {...rest}
    />
  );
};

export default AppIcon;
export type { IconProps };
