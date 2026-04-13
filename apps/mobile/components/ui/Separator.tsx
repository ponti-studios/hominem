import { spacing } from '@hominem/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '~/components/theme';

interface SeparatorProps {
  /** Left margin — defaults to spacing[4]=16 to align with row body text */
  inset?: number;
  color?: 'default' | 'subtle';
}

export function Separator({ inset = spacing[4], color = 'subtle' }: SeparatorProps) {
  return (
    <View
      style={[
        styles.line,
        { marginLeft: inset },
        color === 'default'
          ? styles.colorDefault
          : styles.colorSubtle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
  },
  colorDefault: {
    backgroundColor: theme.colors['border-default'],
  },
  colorSubtle: {
    backgroundColor: theme.colors['border-subtle'],
  },
});
