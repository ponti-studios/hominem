import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

interface IconButtonGroupProps {
  children: React.ReactNode;
  gap?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButtonGroup({ children, gap = 8, style }: IconButtonGroupProps) {
  return <View style={[styles.group, { gap }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
