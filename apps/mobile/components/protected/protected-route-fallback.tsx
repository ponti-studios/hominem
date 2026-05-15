import React from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '~/components/theme';

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bootstrapShell: {
    flex: 1,
    justifyContent: 'space-between',
  },
  bootstrapList: {
    flex: 1,
    paddingTop: theme.spacing.md,
  },
  bootstrapRow: {
    alignItems: 'center',
    flexDirection: 'row',
    columnGap: theme.spacing.md,
    minHeight: 56,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomColor: theme.colors['border-faint'],
    borderBottomWidth: 1,
  },
  bootstrapIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors['border-subtle'],
  },
  bootstrapLinePrimary: {
    height: 12,
    width: '54%',
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors['border-subtle'],
  },
  bootstrapLineSecondary: {
    marginTop: theme.spacing.sm,
    height: 10,
    width: '34%',
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors['border-faint'],
  },
  bootstrapText: {
    flex: 1,
  },
  bootstrapComposerWrap: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  bootstrapComposer: {
    minHeight: 56,
    borderRadius: theme.borderRadii.lg,
    borderWidth: 1,
    borderColor: theme.colors['border-faint'],
    backgroundColor: theme.colors['bg-surface'],
  },
});

export function ProtectedRouteFallback() {
  return (
    <View testID="protected-route-fallback" style={styles.root}>
      <View style={styles.bootstrapShell}>
        <View style={styles.bootstrapList}>
          {Array.from({ length: 6 }, (_, index) => (
            <View key={`bootstrap-row-${index.toString()}`} style={styles.bootstrapRow}>
              <View style={styles.bootstrapIcon} />
              <View style={styles.bootstrapText}>
                <View style={styles.bootstrapLinePrimary} />
                <View style={styles.bootstrapLineSecondary} />
              </View>
            </View>
          ))}
        </View>
        <View style={styles.bootstrapComposerWrap}>
          <View style={styles.bootstrapComposer} />
        </View>
      </View>
    </View>
  );
}
