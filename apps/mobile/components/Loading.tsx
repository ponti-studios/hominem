import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@hominem/ui/tokens';
import { Text } from '@hominem/ui/text';
import { Skeleton } from '~/components/animated/skeleton';

type LoadingVariant = 'page' | 'inline' | 'skeleton';

interface LoadingProps {
  variant?: LoadingVariant;
  message?: string;
}

export function Loading({ variant = 'inline', message }: LoadingProps) {
  if (variant === 'page') {
    return (
      <View
        style={styles.page}
        accessibilityLiveRegion="polite"
        accessibilityLabel={message ?? 'Loading'}
      >
        <ActivityIndicator size="large" color={styles.spinnerColor.color} />
        {message ? (
          <Text variant="body-3" color="text-tertiary" style={styles.pageMessage}>
            {message}
          </Text>
        ) : null}
      </View>
    );
  }

  if (variant === 'skeleton') {
    return (
      <View style={styles.skeletonContainer} accessibilityLabel="Loading content">
        <Skeleton height={14} width="100%" />
        <Skeleton height={14} width="72%" />
        <Skeleton height={14} width="88%" />
      </View>
    );
  }

  return (
    <View style={styles.inline} accessibilityLabel={message ?? 'Loading'}>
      <ActivityIndicator size="small" color={styles.spinnerColor.color} />
      {message ? (
        <Text variant="body-3" color="text-secondary">
          {message}
        </Text>
      ) : null}
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
  pageMessage: {
    marginTop: spacing[1],
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  skeletonContainer: {
    gap: spacing[2],
    paddingVertical: spacing[3],
  },
  // Extracts token color for ActivityIndicator's non-style prop
  spinnerColor: {
    color: colors['text-tertiary'],
  },
});
