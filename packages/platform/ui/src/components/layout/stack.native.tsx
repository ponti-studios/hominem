import { View, type ViewProps, type ViewStyle } from 'react-native';

import { spacing } from '../../tokens';
import { interleaveChildren } from './shared';
import type { GapToken, StackBaseProps } from './stack.types';

const gapMap: Record<GapToken, number> = {
  none: 0,
  xs: spacing[1],
  sm: spacing[2],
  md: spacing[4],
  lg: spacing[5],
  xl: spacing[6],
};

interface StackProps extends ViewProps, StackBaseProps {}

function Stack({ children, divider, gap = 'md', style, ...props }: StackProps) {
  const stackStyle: ViewStyle = {
    flexDirection: 'column',
    rowGap: gapMap[gap],
  };

  return (
    <View style={[stackStyle, style]} {...props}>
      {divider ? interleaveChildren(children, divider) : children}
    </View>
  );
}

export { Stack };
export type { StackProps };
