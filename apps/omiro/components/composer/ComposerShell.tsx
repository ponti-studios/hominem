import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';

import { makeStyles, shadowsNative } from '~/components/theme';

interface ComposerShellProps {
  accessory?: React.ReactNode;
  inlinePanel?: React.ReactNode;
  toolbar: React.ReactNode;
  input: React.ReactNode;
  testID?: string;
}

export function ComposerShell({
  accessory,
  inlinePanel,
  toolbar,
  input,
  testID,
}: ComposerShellProps) {
  const styles = useStyles();

  return (
    <View style={styles.surface} testID={testID}>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      <View style={styles.inputRow}>{input}</View>
      {inlinePanel ? <View style={styles.inlinePanel}>{inlinePanel}</View> : null}
      <View style={styles.toolbarRow}>{toolbar}</View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    ...shadowsNative.low,
    backgroundColor: theme.colors['bg-elevated'],
    borderColor: theme.colors['border-default'],
    borderWidth: 1,
    borderRadius: radii.xl,
    elevation: 6,
    overflow: 'hidden',
    paddingHorizontal: spacing[3],
    paddingTop: spacing[3],
    paddingBottom: spacing[2],
    gap: spacing[1],
    width: '100%',
  },
  accessory: {
    width: '100%',
  },
  inputRow: {
    width: '100%',
  },
  inlinePanel: {
    width: '100%',
  },
  toolbarRow: {
    width: '100%',
  },
}));
