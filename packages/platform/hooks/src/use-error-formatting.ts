import { useCallback } from 'react';

export interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

/**
 * Hook for consistent error formatting across web and mobile.
 * Formats API errors and JavaScript errors into a display-friendly format.
 */
export function useErrorFormatting() {
  const formatError = useCallback((error: unknown): ApiError => {
    // Handle API error response objects
    if (error && typeof error === 'object' && 'message' in error) {
      const err = error as Record<string, unknown>;
      const result: ApiError = {
        message: typeof err.message === 'string' ? err.message : 'An error occurred',
      };
      if (typeof err.code === 'string') {
        result.code = err.code;
      }
      if (typeof err.details === 'object') {
        result.details = err.details as Record<string, unknown>;
      }
      return result;
    }

    // Handle Error objects
    if (error instanceof Error) {
      const result: ApiError = {
        message: error.message || 'An error occurred',
      };
      const errRecord = error as Error & Record<string, unknown>;
      if (typeof errRecord.code === 'string') {
        result.code = errRecord.code;
      }
      return result;
    }

    // Handle strings
    if (typeof error === 'string') {
      return {
        message: error || 'An error occurred',
      };
    }

    // Fallback for unknown errors
    return {
      message: 'An unexpected error occurred',
    };
  }, []);

  const getErrorMessage = useCallback(
    (error: unknown): string => {
      return formatError(error).message;
    },
    [formatError],
  );

  return {
    formatError,
    getErrorMessage,
  };
}
