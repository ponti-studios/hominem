import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface AppIconButtonGroupProps {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export function AppIconButtonGroup({ children, gap = 8, style }: AppIconButtonGroupProps) {
  return <View style={[styles.group, { gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
