import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { View, StyleSheet } from 'react-native';
import Reanimated, { FadeIn } from 'react-native-reanimated';

import { makeStyles, Text } from '~/components/theme';
import { logError } from '~/components/error-boundary/log-error';
import { Button } from '@hominem/ui/button';
import { SymbolView } from 'expo-symbols';

const ICON_RING_SIZE = 56;
const ICON_SIZE = 24;

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  featureName?: string;
}

  const useStyles = makeStyles((t) =>
    StyleSheet.create({
      container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.colors.background,
        paddingHorizontal: t.spacing.ml_24,
        paddingVertical: t.spacing.ml_24,
      },
    card: {
      width: '100%',
      maxWidth: 360,
      alignSelf: 'center',
      alignItems: 'center',
      backgroundColor: t.colors['bg-surface'],
      borderColor: t.colors['border-subtle'],
      borderRadius: t.borderRadii.xl,
      borderWidth: 1,
      paddingHorizontal: t.spacing.ml_24,
      paddingVertical: t.spacing.l_32,
      gap: t.spacing.sm_12,
    },
    iconRing: {
      width: ICON_RING_SIZE,
      height: ICON_RING_SIZE,
      borderRadius: ICON_RING_SIZE / 2,
      backgroundColor: t.colors['bg-elevated'],
      borderWidth: 1,
      borderColor: t.colors['border-subtle'],
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.xs_4,
    },
    title: {
      textAlign: 'center',
      marginBottom: t.spacing.xs_4,
    },
    description: {
      textAlign: 'center',
      maxWidth: 260,
    },
    details: {
      width: '100%',
      backgroundColor: t.colors['bg-base'],
      borderColor: t.colors['border-subtle'],
      borderRadius: t.borderRadii.md,
      borderWidth: 1,
      paddingHorizontal: t.spacing.sm_12,
      paddingVertical: t.spacing.sm_12,
      marginTop: t.spacing.xs_4,
    },
    errorText: {
      fontSize: 12,
      lineHeight: 16,
      color: t.colors['text-tertiary'],
      fontFamily: 'monospace',
    },
    button: {
      alignSelf: 'stretch',
      marginTop: t.spacing.sm_8,
    },
  }),
);

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
  const styles = useStyles();
  const message = error instanceof Error ? error.message : String(error);

  return (
    <Reanimated.View
      style={styles.container}
      entering={FadeIn.duration(180)}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.card}>
        <View style={styles.iconRing}>
          <SymbolView
            name="exclamationmark.triangle.fill"
            size={ICON_SIZE}
            tintColor="#FF7B5C"
            resizeMode="center"
          />
        </View>

        <Text variant="title2" style={styles.title} color="foreground">
          Something went wrong
        </Text>

        <Text variant="body" style={styles.description} color="text-tertiary">
          {createFeatureMessage(featureName)}
        </Text>

        {__DEV__ && message ? (
          <View style={styles.details}>
            <Text style={styles.errorText} numberOfLines={4}>
              {message}
            </Text>
          </View>
        ) : null}

        <Button
          onPress={resetErrorBoundary}
          variant="secondary"
          style={styles.button}
          title="Try Again"
        />
      </View>
    </Reanimated.View>
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
