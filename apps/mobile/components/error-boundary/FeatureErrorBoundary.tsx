import {
  Button as SwiftUIButton,
  Host as SwiftUIHost,
  Image as SwiftUIImage,
  Text as SwiftUIText,
  VStack,
} from '@expo/ui/swift-ui';
import { buttonStyle, font, foregroundStyle, frame, padding } from '@expo/ui/swift-ui/modifiers';
import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';
import { StyleSheet } from 'react-native';

import { logError } from '~/components/error-boundary/log-error';

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

  return (
    <SwiftUIHost style={styles.host} useViewportSizeMeasurement>
      <VStack
        alignment="center"
        spacing={12}
        modifiers={[frame({ maxWidth: 360 }), padding({ all: 24 })]}
      >
        <SwiftUIImage systemName="exclamationmark.triangle.fill" size={28} color="#FF7B5C" />
        <SwiftUIText modifiers={[font({ size: 22, weight: 'bold' })]}>
          Something went wrong
        </SwiftUIText>
        <SwiftUIText
          modifiers={[
            font({ size: 16 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        >
          {createFeatureMessage(featureName)}
        </SwiftUIText>

        {__DEV__ && message ? (
          <SwiftUIText
            modifiers={[
              font({ size: 12, design: 'monospaced' }),
              foregroundStyle({ type: 'hierarchical', style: 'tertiary' }),
            ]}
          >
            {message}
          </SwiftUIText>
        ) : null}

        <SwiftUIButton
          label="Try Again"
          onPress={resetErrorBoundary}
          modifiers={[buttonStyle('bordered'), frame({ maxWidth: Number.POSITIVE_INFINITY })]}
        />
      </VStack>
    </SwiftUIHost>
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
  },
});
