// Error classes for database services. Internal to @hominem/db - used by
// services that need to throw errors the API layer can catch.

import { z } from 'zod';

const errorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
  'UNAVAILABLE',
]);

const failureTypeSchema = z.enum([
  'validation.invalid_input',
  'resource.not_found',
  'auth.unauthenticated',
  'auth.forbidden',
  'service.unavailable',
  'service.internal_error',
  'note.not_found',
  'note.files_unavailable',
  'note.reference_unavailable',
  'chat.not_found',
  'chat.message.not_found',
  'chat.tool_call.not_found',
  'task.not_found',
  'file.not_found',
  'file.upload.invalid_input',
  'file.upload.failed',
  'file.delete.failed',
  'file.storage.config_missing',
  'file.storage.credentials_invalid',
  'file.storage.network_unreachable',
  'file.storage.bucket_missing',
  'file.storage.failed',
  'image.cache_write_failed',
  'image.cache_lock_release_failed',
  'image.proxy_failed',
  'image.size_limit_exceeded',
  'image.url_required',
  'image.domain_not_allowed',
  'image.upstream_failed',
  'mcp.tool.invalid_input',
  'mcp.tool.invocation_failed',
  'possession.not_found',
  'possession.container_not_found',
  'collection.not_found',
  'career.import.not_found',
  'request.unhandled_exception',
  'request.route_not_found',
  'chat.request.invalid_input',
  'chat.request.rejected',
  'chat.request.provider_failed',
  'chat.request.validation_failed',
  'chat.request.failed',
  'chat.request.unsupported_capability',
  'chat.generation.not_found',
  'chat.generation.failed',
  'chat.generation.provider_failed',
  'chat.generation.tool_failed',
  'chat.generation.transport_failed',
  'chat.generation.persistence_failed',
  'chat.generation.unknown_failed',
  'chat.speech.stream_failed',
  'chat.tool_plan.unavailable',
  'chat.tool_plan.validation_failed',
  'file.storage.object_missing',
  'file.processing.failed',
  'file.analysis.image_failed',
  'file.analysis.document_failed',
  'embedding.generation.empty_result',
  'embedding.generation.failed',
  'resume.analysis.failed',
  'generation.notification.malformed',
  'generation.notification.resolve_failed',
  'generation.notification.connection_failed',
  'generation.notification.listener_failed',
  'ai.task_extract.failed',
  'ai.voice_task_extract.failed',
  'ai.time_block_extract.failed',
  'ai.note_generate.failed',
  'ai.text_enhance.failed',
  'career.import.failed',
  'career.import.worker_failed',
  'career.import.stalled',
  'airport.catalogue_sync.failed',
  'chat.file_cleanup.failed',
  'thames.invite.failed',
  'credential.budget.failed',
  'credit.page.failed',
  'credit.checkout.failed',
  'credit.status.failed',
  'credit.webhook.failed',
  'health_check.failed',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type FailureType = z.infer<typeof failureTypeSchema>;

const defaultFailureTypes: Record<ErrorCode, FailureType> = {
  VALIDATION_ERROR: 'validation.invalid_input',
  NOT_FOUND: 'resource.not_found',
  UNAUTHORIZED: 'auth.unauthenticated',
  FORBIDDEN: 'auth.forbidden',
  UNAVAILABLE: 'service.unavailable',
  INTERNAL_ERROR: 'service.internal_error',
};

const notFoundFailureTypes: Record<string, FailureType> = {
  Chat: 'chat.not_found',
  ChatMessage: 'chat.message.not_found',
  ChatMessageToolCall: 'chat.tool_call.not_found',
  Collection: 'collection.not_found',
  Container: 'possession.container_not_found',
  File: 'file.not_found',
  Note: 'note.not_found',
  Possession: 'possession.not_found',
  Task: 'task.not_found',
  'Career import': 'career.import.not_found',
};

function getNotFoundFailureType(resource: string): FailureType {
  return notFoundFailureTypes[resource] ?? 'resource.not_found';
}

export class ServiceError extends Error {
  public readonly code: ErrorCode;
  public readonly failureType: FailureType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: Record<string, unknown>,
    failureType: FailureType = defaultFailureTypes[code],
  ) {
    super(message);
    this.code = code;
    this.failureType = failureType;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, ServiceError.prototype);
    // `this.constructor.name` would read back 'ServiceError' here, since the
    // line above just reset this instance's prototype to ServiceError's —
    // ahead of the subclass's own Object.setPrototypeOf fixing it back.
    // `new.target` names whichever constructor `new` was actually called
    // with (e.g. NotFoundError), independent of that timing.
    this.name = new.target.name;
  }
}

export class ValidationError extends ServiceError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    failureType: FailureType = 'validation.invalid_input',
  ) {
    super(message, 'VALIDATION_ERROR', 400, details, failureType);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class NotFoundError extends ServiceError {
  constructor(
    resource: string,
    details?: Record<string, unknown>,
    failureType: FailureType = getNotFoundFailureType(resource),
  ) {
    super(`${resource} not found`, 'NOT_FOUND', 404, details, failureType);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(
    message = 'Unauthorized',
    details?: Record<string, unknown>,
    failureType: FailureType = 'auth.unauthenticated',
  ) {
    super(message, 'UNAUTHORIZED', 401, details, failureType);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
  }
}

export class ForbiddenError extends ServiceError {
  constructor(
    message = 'Forbidden',
    details?: Record<string, unknown>,
    failureType: FailureType = 'auth.forbidden',
  ) {
    super(message, 'FORBIDDEN', 403, details, failureType);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
  }
}

export class UnavailableError extends ServiceError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    failureType: FailureType = 'service.unavailable',
  ) {
    super(message, 'UNAVAILABLE', 503, details, failureType);
    Object.setPrototypeOf(this, UnavailableError.prototype);
  }
}

export class InternalError extends ServiceError {
  constructor(
    message: string,
    details?: Record<string, unknown>,
    failureType: FailureType = 'service.internal_error',
  ) {
    super(message, 'INTERNAL_ERROR', 500, details, failureType);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

// Matches the duck-typed shape of a ServiceError — used for errors that
// cross a serialization boundary (e.g. a worker/queue payload) and so
// aren't `instanceof ServiceError` even though they came from one.
// `details` isn't validated: callers only need message/code/statusCode to
// treat something as a service error.
const serviceErrorShapeSchema = z.object({
  message: z.string(),
  code: errorCodeSchema,
  failureType: failureTypeSchema.optional(),
  statusCode: z.number().int().min(400).max(599),
});

export function isServiceError(value: unknown): value is ServiceError {
  if (value instanceof ServiceError) {
    return true;
  }

  return serviceErrorShapeSchema.safeParse(value).success;
}

export function getServiceErrorFailureType(error: Pick<ServiceError, 'code' | 'failureType'>) {
  return error.failureType ?? defaultFailureTypes[error.code];
}
