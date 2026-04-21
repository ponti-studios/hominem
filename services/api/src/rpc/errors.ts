// Re-export canonical error hierarchy from @hakumi/db
export {
  ForbiddenError,
  InternalError,
  isServiceError,
  NotFoundError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
  type ErrorCode,
} from '@hakumi/db';
