import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { View, StyleSheet } from 'react-native';

import { makeStyles } from '~/components/theme';
import { createFeatureFallbackLabel } from '~/components/error-boundary/messages';
import { logError } from '~/components/error-boundary/log-error';

import { ErrorMessage } from './ErrorMessage';

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
  }),
);

function FeatureFallback({
  error,
  resetErrorBoundary,
  featureName,
}: FallbackProps & { featureName?: string }) {
  const styles = useStyles();
  const message = error instanceof Error ? error.message : String(error);

  return (
    <View style={styles.container}>
      <ErrorMessage
        title="Something went wrong"
        message={`${createFeatureFallbackLabel(featureName)}. ${message}`}
        actionLabel="Retry"
        onPress={resetErrorBoundary}
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
      fallbackRender={(props) => <FeatureFallback {...props} featureName={featureName} />}
    >
      {children}
    </ErrorBoundary>
  );
}
