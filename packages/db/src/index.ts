/**
 * @hominem/db - Database access layer for `hominem` services
 *
 * NOT for use in client applications - use @hominem/rpc instead.
 */

export type { Selectable } from 'kysely';
export { db, healthCheck, pool, sql } from './db';
export type { DB as Database, Json, JsonArray, JsonObject, JsonValue } from './types/database';

// Transaction support
export { runInTransaction } from './transaction';
export type { DbHandle, TransactionHandle } from './transaction';

// Export database table types
export type * from './types/database';

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
} from './errors';
export type { ErrorCode } from './errors';

// Shared mapper utilities
export { toIsoString, toRequiredIsoString } from './services/_shared/mappers';

// Repositories
export { NoteRepository } from './services/notes/note.repository';
export type {
  ListNoteFeedInput,
  ListNotesInput,
  CreateNoteInput as NoteCreateInput,
  NoteFeedPageRecord,
  NoteFeedRecord,
  NoteFileRecord,
  NoteRecord,
  UpdateNoteInput as NoteUpdateInput,
  SearchNoteResult,
  SearchNotesInput,
} from './services/notes/note.repository';

export { ChatRepository } from './services/chats/chat.repository';
export type {
  ChatMessageFileRecord,
  ChatMessageRecord,
  ChatMessageRole,
  ChatMessageToolCallRecord,
  ChatRecord,
  InsertChatMessageInput,
  NoteContext,
  ReferencedNoteRecord,
} from './services/chats/chat.repository';

export { FileRepository } from './services/files/file.repository';
export type { FileRecord, UpsertFileInput } from './services/files/file.repository';

export { TaskRepository } from './services/tasks/task.repository';
export type { CreateTaskInput, TaskRecord } from './services/tasks/task.repository';

export { CareerRepository } from './services/career/career.repository';
export type {
  CareerCertificationRecord,
  CareerCompanyRecord,
  CareerEventRecord,
  CareerFullPortfolioRecord,
  CareerJobApplicationRecord,
  CareerPortfolioRecord,
  CareerProjectRecord,
  CareerSkillRecord,
  CareerSocialLinksRecord,
  CareerTestimonialRecord,
  CareerWorkExperienceRecord,
  CareerApplicationStage,
  CareerInterviewEntry,
  CreateDefaultCareerPortfolioInput,
  UpdateCareerWorkExperienceInput,
} from './services/career/career.repository';
