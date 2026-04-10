// Re-export canonical error hierarchy from @hominem/db
export {
  ForbiddenError,
  InternalError,
  isServiceError,
  NotFoundError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
  type ErrorCode,
} from '@hominem/db';
