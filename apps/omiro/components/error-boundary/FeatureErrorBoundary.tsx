import { useCallback, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import { ErrorFallback } from '~/components/error-boundary/ErrorFallback';
import { logError } from '~/components/error-boundary/log-error';
import t from '~/translations';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  featureName?: string;
}

function createFeatureMessage(featureName?: string): string {
  if (!featureName) {
    return t.errors.featureFallback.generic;
  }

  return t.errors.featureFallback.withFeature(featureName);
}

function FeatureFallback({
  error,
  resetErrorBoundary,
  featureName,
}: FallbackProps & { featureName?: string }) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    <ErrorFallback
      title={t.errors.somethingWentWrong}
      titleSize="title2"
      message={createFeatureMessage(featureName)}
      debugMessage={message}
      actionLabel={t.errors.featureFallback.tryAgain}
      onAction={resetErrorBoundary}
      buttonVariant="secondary"
    />
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
