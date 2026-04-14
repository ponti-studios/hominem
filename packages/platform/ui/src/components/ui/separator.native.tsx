import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '../../tokens';

interface SeparatorProps {
  color?: 'default' | 'subtle' | undefined;
  inset?: number | undefined;
}

function Separator({ color = 'subtle', inset = spacing[4] }: SeparatorProps) {
  return (
    <View
      style={[
        styles.line,
        { marginLeft: inset },
        color === 'default' ? styles.defaultColor : styles.subtleColor,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
  },
  defaultColor: {
    backgroundColor: colors['border-default'],
  },
  subtleColor: {
    backgroundColor: colors['border-subtle'],
  },
});

export { Separator };
export type { SeparatorProps };
