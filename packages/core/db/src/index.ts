/**
 * @hominem/db - Database access layer for `hominem` services
 *
 * NOT for use in client applications - use @hominem/rpc instead.
 */

export { db, healthCheck, pool, sql } from './db';
export type { DB as Database, Json, JsonArray, JsonObject, JsonValue } from './types/database';
export type { Selectable } from 'kysely';

// Export all database table types for use in services
export type {
  Bookmarks,
  CalendarEvents,
  Chat,
  ChatMessage,
  FinanceAccounts,
  FinanceTransactions,
  HealthRecords,
  Logs,
  Notes,
  Persons,
  Places,
  Possessions,
  Tags,
  TaskLists,
  Tasks,
  UserAccounts,
  Users,
} from './types/database';

// Shared service utilities (used by RPC handlers)
export { brandId, unbrandId } from './services/_shared/ids';
export type {
  BookmarkId,
  CalendarEventId,
  FinanceAccountId,
  FinanceCategoryId,
  FinanceTransactionId,
  PersonId,
  PossessionId,
  TagId,
  TaskId,
  UserId,
} from './services/_shared/ids';

export {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  ValidationError,
  getErrorResponse,
  isDbError,
  isServiceError,
} from './services/_shared/errors';
export type { DbError } from './services/_shared/errors';
