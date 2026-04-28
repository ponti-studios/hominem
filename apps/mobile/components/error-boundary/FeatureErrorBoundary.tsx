import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { StyleSheet, Text, View } from 'react-native';

import { logError } from '~/components/error-boundary/log-error';
import { useThemeColors } from '~/components/theme/theme';
import { Button } from '~/components/ui/button';
import AppIcon from '~/components/ui/icon';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  featureName?: string;
}

function createFeatureMessage(featureName?: string): string {
  if (!featureName) {
    return "This part of the app couldn't load right now.";
  }

  return `${featureName} couldn't load right now.`;
}

function FeatureFallback({
  error,
  resetErrorBoundary,
  featureName,
}: FallbackProps & { featureName?: string }) {
  const message = error instanceof Error ? error.message : String(error);
  const themeColors = useThemeColors();

  return (
    <View style={styles.host}>
      <View style={styles.content}>
        <AppIcon color="#FF7B5C" name="exclamationmark.triangle.fill" size={28} />
        <Text style={[styles.title, { color: themeColors.foreground }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: themeColors['text-secondary'] }]}>
          {createFeatureMessage(featureName)}
        </Text>

        {__DEV__ && message ? (
          <Text style={[styles.debugMessage, { color: themeColors['text-tertiary'] }]}>
            {message}
          </Text>
        ) : null}

        <Button label="Try Again" onPress={resetErrorBoundary} variant="secondary" />
      </View>
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

const styles = StyleSheet.create({
  host: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  debugMessage: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Menlo',
    textAlign: 'center',
  },
});
