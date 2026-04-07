// Re-export canonical error hierarchy from @hominem/db
export {
  ConflictError,
  ForbiddenError,
  InternalError,
  isServiceError,
  NotFoundError,
  ServiceError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
  type ErrorCode,
} from '@hominem/db';
