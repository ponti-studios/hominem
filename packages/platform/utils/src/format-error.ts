/**
 * Centralized error formatting utility for the Hominem platform.
 * Provides consistent error handling across API, web, and mobile apps.
 *
 * Usage:
 *   const formatted = formatApiError(error);
 *   console.log(formatted.message); // User-friendly message
 */

export interface FormattedError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  isNetworkError: boolean;
  isValidationError: boolean;
  isAuthError: boolean;
  statusCode?: number;
}

/**
 * Standard error codes used across the platform
 */
export enum ErrorCode {
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_REFUSED = 'CONNECTION_REFUSED',

  // Authentication
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  AUTH_EXPIRED = 'AUTH_EXPIRED',

  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',

  // Server errors
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT',

  // Business logic
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * User-friendly error messages for common scenarios
 */
const userFriendlyMessages: Record<string, string> = {
  [ErrorCode.NETWORK_ERROR]: 'Network error. Please check your connection.',
  [ErrorCode.TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCode.AUTH_REQUIRED]: 'You must be signed in to perform this action.',
  [ErrorCode.AUTH_INVALID]: 'Invalid credentials. Please try again.',
  [ErrorCode.AUTH_EXPIRED]: 'Your session has expired. Please sign in again.',
  [ErrorCode.VALIDATION_ERROR]: 'Please check your input and try again.',
  [ErrorCode.NOT_FOUND]: 'The requested item was not found.',
  [ErrorCode.CONFLICT]: 'This action conflicts with existing data.',
  [ErrorCode.RATE_LIMIT]: 'Too many requests. Please wait a moment.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to do this.',
  [ErrorCode.SERVER_ERROR]: 'A server error occurred. Please try again later.',
  [ErrorCode.UNKNOWN_ERROR]: 'An unexpected error occurred.',
};

/**
 * Categorize errors for conditional UI handling
 */
function categorizeError(code?: string, statusCode?: number): {
  isNetworkError: boolean;
  isValidationError: boolean;
  isAuthError: boolean;
} {
  const isNetworkError =
    code === ErrorCode.NETWORK_ERROR ||
    code === ErrorCode.TIMEOUT ||
    code === ErrorCode.CONNECTION_REFUSED;

  const isValidationError =
    code === ErrorCode.VALIDATION_ERROR || code === ErrorCode.INVALID_INPUT;

  const isAuthError =
    code === ErrorCode.AUTH_REQUIRED ||
    code === ErrorCode.AUTH_INVALID ||
    code === ErrorCode.AUTH_EXPIRED ||
    statusCode === 401 ||
    statusCode === 403;

  return { isNetworkError, isValidationError, isAuthError };
}

/**
 * Extract error information from various error sources
 */
function extractErrorInfo(error: unknown): {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
  statusCode?: number;
} {
  // Handle error objects from API responses
  if (error && typeof error === 'object') {
    const errObj = error as Record<string, unknown>;

    // Handle fetch errors or Hono errors
    if ('response' in errObj && errObj.response) {
      const response = errObj.response as Record<string, unknown>;
      return {
        message:
          typeof response.message === 'string'
            ? response.message
            : 'An error occurred',
        code: typeof response.code === 'string' ? response.code : undefined,
        statusCode:
          typeof response.status === 'number' ? response.status : undefined,
        details:
          typeof response.details === 'object'
            ? (response.details as Record<string, unknown>)
            : undefined,
      };
    }

    // Handle error responses
    if ('message' in errObj) {
      return {
        message:
          typeof errObj.message === 'string' ? errObj.message : 'An error occurred',
        code: typeof errObj.code === 'string' ? errObj.code : undefined,
        statusCode:
          typeof errObj.status === 'number' || typeof errObj.statusCode === 'number'
            ? ((errObj.status || errObj.statusCode) as number)
            : undefined,
        details:
          typeof errObj.details === 'object'
            ? (errObj.details as Record<string, unknown>)
            : undefined,
      };
    }
  }

  // Handle Error objects
  if (error instanceof Error) {
    const code =
      'code' in error && typeof error.code === 'string'
        ? error.code
        : undefined;

    return {
      message: error.message || 'An error occurred',
      code,
      statusCode:
        'statusCode' in error && typeof error.statusCode === 'number'
          ? error.statusCode
          : undefined,
    };
  }

  // Handle strings
  if (typeof error === 'string') {
    return {
      message: error || 'An error occurred',
    };
  }

  return {
    message: 'An unexpected error occurred',
  };
}

/**
 * Format error for display to users
 *
 * This function takes any error and returns a structured, user-friendly error object.
 * It handles:
 * - Network errors
 * - Validation errors
 * - Authentication errors
 * - Server errors
 * - Unknown errors
 *
 * @param error The error to format (can be any type)
 * @returns Formatted error object with user-friendly message
 *
 * @example
 * try {
 *   await fetchData();
 * } catch (err) {
 *   const formatted = formatApiError(err);
 *   if (formatted.isAuthError) {
 *     // Redirect to login
 *   } else if (formatted.isValidationError) {
 *     // Show validation messages
 *   } else {
 *     // Show generic error
 *     showNotification(formatted.message);
 *   }
 * }
 */
export function formatApiError(error: unknown): FormattedError {
  const { message: rawMessage, code, details, statusCode } = extractErrorInfo(error);

  // Determine error code from various sources
  const errorCode = code || inferErrorCode(statusCode, rawMessage);

  // Get user-friendly message
  const userMessage = userFriendlyMessages[errorCode] || rawMessage;

  // Categorize error
  const { isNetworkError, isValidationError, isAuthError } = categorizeError(
    errorCode,
    statusCode,
  );

  return {
    message: userMessage,
    code: errorCode,
    details,
    isNetworkError,
    isValidationError,
    isAuthError,
    statusCode,
  };
}

/**
 * Infer error code from HTTP status code or message pattern
 */
function inferErrorCode(statusCode?: number, message?: string): string {
  if (!statusCode && !message) {
    return ErrorCode.UNKNOWN_ERROR;
  }

  // Map HTTP status codes to error codes
  if (statusCode) {
    if (statusCode === 400) return ErrorCode.VALIDATION_ERROR;
    if (statusCode === 401) return ErrorCode.AUTH_INVALID;
    if (statusCode === 403) return ErrorCode.INSUFFICIENT_PERMISSIONS;
    if (statusCode === 404) return ErrorCode.NOT_FOUND;
    if (statusCode === 409) return ErrorCode.CONFLICT;
    if (statusCode === 429) return ErrorCode.RATE_LIMIT;
    if (statusCode >= 500) return ErrorCode.SERVER_ERROR;
  }

  // Pattern matching in message
  if (message) {
    const msgLower = message.toLowerCase();
    if (msgLower.includes('network') || msgLower.includes('connection'))
      return ErrorCode.NETWORK_ERROR;
    if (msgLower.includes('timeout')) return ErrorCode.TIMEOUT;
    if (msgLower.includes('auth') || msgLower.includes('unauthorized'))
      return ErrorCode.AUTH_INVALID;
    if (msgLower.includes('validation') || msgLower.includes('invalid'))
      return ErrorCode.VALIDATION_ERROR;
  }

  return ErrorCode.UNKNOWN_ERROR;
}

/**
 * Log error with context for debugging
 * Should be used in error boundaries and top-level handlers
 */
export function logError(
  error: unknown,
  context?: Record<string, unknown>,
): FormattedError {
  const formatted = formatApiError(error);

  // In development, log the original error
  if (typeof window !== 'undefined' && (window as any).__DEV__) {
    console.error('[ERROR]', formatted.code, error, context);
  }

  // In production, could send to error tracking service
  // sendToErrorTracking(formatted, context);

  return formatted;
}
