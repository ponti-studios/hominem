import { radii, spacing } from '@hominem/ui/tokens';
import React from 'react';
import { View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { makeStyles } from '~/components/theme';

interface ComposerSurfaceProps {
  accessory?: React.ReactNode;
  actions?: React.ReactNode;
  input: React.ReactNode;
  leadingAction: React.ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
  testID?: string;
}

export function ComposerSurface({
  accessory,
  actions,
  input,
  leadingAction,
  onLayout,
  testID,
}: ComposerSurfaceProps) {
  const styles = useStyles();

  return (
    <View onLayout={onLayout} style={[styles.surface, styles.content]} testID={testID}>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      {input}
      <View style={[styles.actionRow, actions ? null : styles.actionRowCompact]}>
        <View style={styles.leadingActionSlot}>{leadingAction}</View>
        <View style={styles.actionSlot}>{actions}</View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((theme) => ({
  surface: {
    backgroundColor: theme.colors['white'],
    borderColor: theme.colors['border-subtle'],
    borderLeftWidth: 1,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderRightWidth: 1,
    borderTopWidth: 1,
    borderBottomWidth: 0,
    overflow: 'hidden',
    width: '100%',
  },
  content: {
    gap: spacing[1],
    paddingBottom: spacing[3],
    paddingHorizontal: spacing[2],
    paddingTop: spacing[1],
  },
  accessory: {
    gap: spacing[2],
    width: '100%',
  },
  actionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 0,
    minHeight: spacing[5],
    width: '100%',
  },
  actionRowCompact: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 0,
    minHeight: 0,
    width: 'auto',
  },
  leadingActionSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSlot: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
}));
