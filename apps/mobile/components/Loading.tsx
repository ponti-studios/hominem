import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { makeStyles, Text } from '~/components/theme';
import { Skeleton } from '~/components/animated/skeleton';

type LoadingVariant = 'page' | 'inline' | 'skeleton';

interface LoadingProps {
  variant?: LoadingVariant;
  message?: string;
}

export function Loading({ variant = 'inline', message }: LoadingProps) {
  const styles = useStyles();

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

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    page: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: t.spacing.sm_12,
      backgroundColor: t.colors.background,
    },
    pageMessage: {
      marginTop: t.spacing.xs_4,
    },
    inline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm_8,
      paddingVertical: t.spacing.sm_12,
    },
    skeletonContainer: {
      gap: t.spacing.sm_8,
      paddingVertical: t.spacing.sm_12,
    },
    // Extracts theme color for ActivityIndicator's non-style prop
    spinnerColor: {
      color: t.colors['text-tertiary'],
    },
  }),
);
