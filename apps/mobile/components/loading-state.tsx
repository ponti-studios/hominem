import { StyleSheet, View } from 'react-native';

import { Box, makeStyles, Text, theme } from '~/components/theme';
import { Skeleton } from '~/components/animated/skeleton';

type LoadingVariant = 'page' | 'inline' | 'skeleton';

interface LoadingStateProps {
  variant?: LoadingVariant;
  message?: string;
}

export function LoadingState({ variant = 'inline', message = 'Loading...' }: LoadingStateProps) {
  const styles = useStyles();

  if (variant === 'page') {
    return (
      <Box style={styles.page}>
        <View style={styles.spinner} />
        {message ? <Text color="text-secondary">{message}</Text> : null}
      </Box>
    );
  }

  if (variant === 'skeleton') {
    return (
      <View style={styles.skeletonContainer}>
        <Skeleton height={12} width="100%" />
        <Skeleton height={12} width="70%" />
        <Skeleton height={12} width="85%" />
      </View>
    );
  }

  return (
    <View style={styles.inline}>
      <View style={styles.spinnerSmall} />
      {message ? <Text color="text-secondary">{message}</Text> : null}
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
    inline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.sm_12,
      paddingVertical: t.spacing.sm_12,
    },
    spinner: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.colors.foreground,
      opacity: 0.16,
    },
    spinnerSmall: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: theme.colors.foreground,
      opacity: 0.16,
    },
    skeletonContainer: {
      gap: t.spacing.xs_4,
      paddingVertical: t.spacing.sm_12,
    },
  }),
);
