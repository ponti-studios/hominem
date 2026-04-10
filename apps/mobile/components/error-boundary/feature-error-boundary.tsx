import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { View, StyleSheet } from 'react-native';

import { Button } from '~/components/Button';
import { Text, makeStyles } from '~/theme';
import {
  createFeatureFallbackLabel,
  type BoundaryState,
} from '~/lib/error-boundary/error-boundary/contracts';
import { logError } from '~/lib/error-boundary/error-boundary/log-error';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  featureName?: string;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      padding: t.spacing.m_16,
      backgroundColor: t.colors.muted,
      borderRadius: t.borderRadii.md,
      borderWidth: 1,
      borderColor: t.colors['border-default'],
      alignItems: 'center',
    },
    button: {
      marginTop: t.spacing.sm_12,
      backgroundColor: t.colors.background,
      borderColor: t.colors['border-default'],
    },
  }),
);

function FeatureFallback({
  error,
  resetErrorBoundary,
  featureName,
}: FallbackProps & { featureName?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.container}>
      <Text variant="body" color="text-tertiary">
        {createFeatureFallbackLabel(featureName)}
      </Text>
      <Button
        variant="outline"
        size="sm"
        style={styles.button}
        onPress={resetErrorBoundary}
        title="Retry"
      />
    </View>
  );
}

export function FeatureErrorBoundary({ children, fallback, onError, featureName }: Props) {
  const handleError = useCallback(
    (error: unknown, errorInfo: React.ErrorInfo) => {
      const err = error instanceof Error ? error : new Error(String(error));
      logError(err, errorInfo, { feature: featureName });
      onError?.(err, errorInfo);
    },
    [onError, featureName],
  );

  if (fallback) {
    return (
      <ErrorBoundary onError={handleError} fallback={fallback}>
        {children}
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary
      onError={handleError}
      fallbackRender={(props) => (
        <FeatureFallback {...props} featureName={featureName} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}