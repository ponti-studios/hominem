/**
 * @hominem/db - Database access layer for `hominem` services
 *
 * NOT for use in client applications - use @hominem/rpc instead.
 */

export type { Selectable } from 'kysely';
export { authDb, db, healthCheck, pool, sql } from './db';
export type { DB, Json, JsonArray, JsonObject, JsonValue } from './types/database';
export type { Database } from './db';

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
export type {
  CreateTaskBatchInput,
  CreateTaskInput,
  TaskBatchRecord,
  TaskListRecord,
  TaskRecord,
} from './services/tasks/task.repository';

export { VectorDocumentRepository } from './services/vector/vector-document.repository';
export type {
  SearchVectorDocumentsInput,
  UpsertVectorDocumentInput,
  VectorDocumentEntityType,
  VectorDocumentRecord,
  VectorDocumentSearchResult,
} from './services/vector/vector-document.repository';

export { AIUsageEventRepository } from './services/ai/ai-usage.repository';
export type {
  AIUsageEventRecord,
  AIUsageFeature,
  AIUsageFeatureBreakdownRecord,
  AIUsageModelBreakdownRecord,
  AIUsageOperation,
  AIUsageSummaryRecord,
  CreateAIUsageEventInput,
} from './services/ai/ai-usage.repository';

export { CareerRepository } from './services/career/career.repository';
export type {
  CareerApplicationStage,
  CareerCertificationRecord,
  CareerCompanyRecord,
  CareerEventRecord,
  CareerFullPortfolioRecord,
  CareerInterviewEntry,
  CareerJobApplicationRecord,
  CareerPortfolioRecord,
  CareerProjectRecord,
  CareerSkillRecord,
  CareerTestimonialRecord,
  CareerUserSocialLinksRecord,
  CareerWorkExperienceRecord,
  CreateDefaultCareerPortfolioInput,
  UpdateCareerJobApplicationInput,
  UpdateCareerWorkExperienceInput,
} from './services/career/career.repository';

export { UserRepository } from './services/users/user.repository';
export type { FindUserInput, UserRecord } from './services/users/user.repository';
