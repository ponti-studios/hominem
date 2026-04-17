import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { theme } from '~/components/theme';

interface CustomIconProps {
  name: string;
  size?: number;
  color?: string;
}

const customIconPaths: Record<string, string> = {};

const CustomIcon: React.FC<CustomIconProps> = ({
  name,
  size = 24,
  color = theme.colors['icon-primary'],
}) => {
  const pathData = customIconPaths[name];

  if (!pathData) {
    if (__DEV__) {
      console.warn(`CustomIcon "${name}" not found`);
    }
    return null;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d={pathData} fill={color} />
    </Svg>
  );
};

export default CustomIcon;
