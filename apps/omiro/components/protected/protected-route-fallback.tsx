import React from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '~/components/theme';

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors['surface-canvas'],
  },
});

export function ProtectedRouteFallback() {
  return <View testID="protected-route-fallback" style={styles.root} />;
}
