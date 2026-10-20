// just re-exporting the shared error types from @hominem/db
export {
  ForbiddenError,
  getServiceErrorFailureType,
  InternalError,
  isServiceError,
  NotFoundError,
  ServiceError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
  type ErrorCode,
  type FailureType,
} from '@hominem/db/errors';
