import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text, makeStyles } from '~/components/theme';

interface PageHeaderProps {
  /**
   * The primary headline. Rendered in `display` — 40px bold, tight tracking.
   * On a standard device width this naturally wraps one or two words per line,
   * giving the editorial cadence without any manual line-breaking.
   */
  title: string;
  /**
   * Secondary label rendered in `overline` — 11px medium, uppercase, wide
   * tracking. Use for contextual bylines, section descriptors, or status.
   */
  description?: string;
  /**
   * Optional node placed to the right of the text block. Use for a single
   * icon button or badge — not a full toolbar.
   */
  action?: React.ReactNode;
  /**
   * Hairline divider below the header. Default true. Set false when the screen
   * content immediately follows with its own visual boundary (e.g. a list with
   * a top separator).
   */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function PageHeader({ title, description, action, divider = true, style }: PageHeaderProps) {
  const styles = useStyles();

  return (
    <View style={[styles.root, style]}>
      <View style={styles.row}>
        <View style={styles.text}>
          {description ? (
            <Text variant="overline" color="text-tertiary">
              {description}
            </Text>
          ) : null}
          <Text variant="display">{title}</Text>
        </View>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
      {divider ? <View style={styles.divider} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      rowGap: t.spacing.ml_24,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    text: {
      flex: 1,
      rowGap: t.spacing.sm_8,
    },
    action: {
      paddingLeft: t.spacing.m_16,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors['border-default'],
    },
  }),
);
