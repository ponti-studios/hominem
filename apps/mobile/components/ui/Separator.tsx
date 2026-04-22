import { StyleSheet, View } from 'react-native';

import { makeStyles } from '~/components/theme';
import { spacing } from '~/components/theme/tokens';

interface SeparatorProps {
  color?: 'default' | 'subtle' | undefined;
  inset?: number | undefined;
}

function Separator({ color = 'subtle', inset = spacing[4] }: SeparatorProps) {
  const styles = useSeparatorStyles();
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

const useSeparatorStyles = makeStyles((theme) => ({
  line: {
    height: StyleSheet.hairlineWidth,
  },
  defaultColor: {
    backgroundColor: theme.colors['border-default'],
  },
  subtleColor: {
    backgroundColor: theme.colors['border-subtle'],
  },
}));

export { Separator };
export type { SeparatorProps };
