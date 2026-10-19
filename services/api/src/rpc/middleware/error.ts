import { logger, recordTelemetryException } from '@hominem/telemetry';
import type { Context } from 'hono';

import { isContentfulStatusCode } from '../../utils/http-status';
import { isServiceError, type ErrorCode, type ServiceError } from '../errors';
import type { AppContext } from './auth';

export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown> | undefined;
}

function findServiceError(value: unknown, depth = 0): ServiceError | null {
  if (isServiceError(value)) {
    return value;
  }

  if (!(value instanceof Error) || depth >= 3) {
    return null;
  }

  return findServiceError(value.cause, depth + 1);
}

export function apiErrorHandler(err: unknown, c: Context<AppContext>) {
  const requestId = c.get('requestId') || crypto.randomUUID().slice(0, 8);
  // Prefer Hono's registered route template so dynamic path parameters never
  // enter logs. Unmatched routes use a static value instead of the raw path.
  const path = c.req.routePath || 'unmatched';
  const method = c.req.method;
  const serviceError = findServiceError(err);

  if (serviceError) {
    const logData = {
      code: serviceError.code,
      message: serviceError.message,
      method,
      path,
      requestId,
      statusCode: serviceError.statusCode,
      ...(serviceError.details ? { details: serviceError.details } : {}),
    };

    if (serviceError.statusCode >= 500) {
      recordTelemetryException(serviceError);
      logger.error('api_request_failed', {
        method,
        path,
        requestId,
        statusCode: serviceError.statusCode,
        error_name: serviceError.name,
        failureCategory: serviceError.code.toLowerCase(),
      });
    } else if (process.env.NODE_ENV !== 'test') {
      logger.warn('[API Client Error]', logData);
    }

    if (!isContentfulStatusCode(serviceError.statusCode)) {
      return c.json<ApiErrorResponse>(
        {
          error: 'internal_error',
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        500,
      );
    }

    return c.json<ApiErrorResponse>(
      {
        error: serviceError.code.toLowerCase(),
        code: serviceError.code,
        message: serviceError.message,
        details: serviceError.details,
      },
      // `isServiceError` (via `findServiceError`) validates this range.
      serviceError.statusCode,
    );
  }

  recordTelemetryException(err);
  logger.error('http_request_failed', {
    method,
    path,
    statusCode: 500,
    requestId,
    error: err,
    error_name: err instanceof Error ? err.name : 'unknown',
    failureCategory: 'unhandled',
  });

  const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
  return c.json<ApiErrorResponse>(
    {
      error: 'internal_error',
      code: 'INTERNAL_ERROR',
      message: errorMessage,
    },
    500,
  );
}
