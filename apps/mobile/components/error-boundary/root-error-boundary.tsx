import { useCallback, useState, type ReactNode } from 'react';
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary';

import {
  createRootFallbackMessage,
  type BoundaryState,
} from '~/lib/error-boundary/error-boundary/contracts';
import { logError } from '~/lib/error-boundary/error-boundary/log-error';

import { FullScreenErrorFallback } from './full-screen-error-fallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

function RootFallback({ error, resetErrorBoundary }: FallbackProps) {
  const err = error instanceof Error ? error : new Error(String(error));
  return (
    <FullScreenErrorFallback
      actionLabel="Try Again"
      message={createRootFallbackMessage(err)}
      onPress={resetErrorBoundary}
    />
  );
}

export function RootErrorBoundary({ children, fallback, onError }: Props) {
  const [, setState] = useState<BoundaryState>({ hasError: false, error: null });

  const handleError = useCallback(
    (error: unknown, errorInfo: React.ErrorInfo) => {
      const err = error instanceof Error ? error : new Error(String(error));
      logError(err, errorInfo);
      onError?.(err, errorInfo);
    },
    [onError],
  );

  const handleReset = useCallback(() => {
    setState({ hasError: false, error: null });
  }, []);

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
      fallbackRender={({ error, resetErrorBoundary }) => (
        <RootFallback error={error} resetErrorBoundary={resetErrorBoundary} />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}