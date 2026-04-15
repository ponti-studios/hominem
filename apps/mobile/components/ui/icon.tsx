import { SymbolView, type SFSymbol } from "expo-symbols";

import { theme } from "~/components/theme";

interface IconProps {
  color?: string | undefined;
  name: SFSymbol;
  size?: number | undefined;
}

const AppIcon = ({ color, name, size = 24 }: IconProps) => {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color ?? theme.colors["icon-primary"]}
    />
  );
};

export default AppIcon;
export type { IconProps };