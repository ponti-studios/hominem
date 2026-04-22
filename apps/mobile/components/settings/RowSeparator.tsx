import React from 'react';
import { View } from 'react-native';

import { useSharedStyles } from '../theme/styles';

export function RowSeparator() {
  const styles = useSharedStyles();
  return <View style={styles.rowSeparator} />;
}
