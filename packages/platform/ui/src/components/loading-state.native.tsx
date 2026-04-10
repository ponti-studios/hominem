import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '../tokens';

export type LoadingVariant = 'page' | 'inline' | 'skeleton';

export interface LoadingStateProps {
  variant?: LoadingVariant;
  message?: string;
  className?: string;
  skeletonLines?: number;
  skeletonLineHeight?: string;
  delayMs?: number;
  children?: ReactNode;
}

export function LoadingState({
  variant = 'inline',
  message = 'Loading...',
  children,
}: LoadingStateProps) {
  if (children) {
    return <>{children}</>;
  }

  if (variant === 'page') {
    return (
      <View style={styles.page}>
        <View style={styles.spinner} />
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    );
  }

  if (variant === 'skeleton') {
    return (
      <View style={styles.skeletonContainer}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.skeletonShort]} />
        <View style={[styles.skeletonLine, styles.skeletonMedium]} />
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <View style={styles.spinnerSmall} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.background,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  spinner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.foreground,
    opacity: 0.16,
  },
  spinnerSmall: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.foreground,
    opacity: 0.16,
  },
  message: {
    color: colors['text-secondary'],
  },
  skeletonContainer: {
    gap: spacing[1],
    paddingVertical: spacing[3],
  },
  skeletonLine: {
    height: 12,
    width: '100%',
    borderRadius: 6,
    backgroundColor: colors.muted,
  },
  skeletonShort: {
    width: '70%',
  },
  skeletonMedium: {
    width: '85%',
  },
});
