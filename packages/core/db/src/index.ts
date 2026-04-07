/**
 * @hominem/db - Database access layer for `hominem` services
 *
 * NOT for use in client applications - use @hominem/rpc instead.
 */

export { db, healthCheck, pool, sql } from './db';
export type { DB as Database, Json, JsonArray, JsonObject, JsonValue } from './types/database';
export type { Selectable } from 'kysely';

// Transaction support
export { runInTransaction, getDb } from './transaction';
export type { TransactionHandle, DbHandle } from './transaction';

// Export all database table types for use in services
export type {
  Account,
  AppBookmarks,
  AppChatMessages,
  AppChats,
  AppEntities,
  AppEntityLinks,
  AppEventAttendees,
  AppEvents,
  AppFiles,
  AppFinanceAccounts,
  AppFinanceInstitutions,
  AppFinanceTransactions,
  AppGoals,
  AppKeyResults,
  AppMusicAlbums,
  AppMusicArtists,
  AppMusicListens,
  AppMusicPlaylistTracks,
  AppMusicPlaylists,
  AppMusicTracks,
  AppNoteFiles,
  AppNoteShares,
  AppNoteVersions,
  AppNotes,
  AppPeople,
  AppPlaces,
  AppPlaidItems,
  AppPossessionContainers,
  AppPossessionEvents,
  AppPossessions,
  AppSpaceInvites,
  AppSpaceItems,
  AppSpaceMembers,
  AppSpaceTags,
  AppSpaces,
  AppTagAliases,
  AppTagAssignments,
  AppTags,
  AppTaskAssignments,
  AppTasks,
  AppTravelTrips,
  AppVideoChannels,
  AppVideoViews,
  DeviceCode,
  GooseDbVersion,
  Jwks,
  OpsAuditLogs,
  OpsSearchLogs,
  Passkey,
  Session,
  User,
  Verification,
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

// Shared mapper utilities
export { toIsoString, toRequiredIsoString } from './services/_shared/mappers';

// Repositories
export { NoteRepository } from './services/notes/note.repository';
export type {
  NoteRecord,
  NoteFeedPageRecord,
  NoteFeedRecord,
  NoteFileRecord,
  CreateNoteInput as NoteCreateInput,
  UpdateNoteInput as NoteUpdateInput,
  ListNoteFeedInput,
  ListNotesInput,
  SearchNotesInput,
  SearchNoteResult,
} from './services/notes/note.repository';

export { ChatRepository } from './services/chats/chat.repository';
export type {
  ChatRecord,
  ChatMessageRecord,
  ChatMessageFileRecord,
  ChatMessageToolCallRecord,
  ReferencedNoteRecord,
  ChatMessageRole,
  InsertChatMessageInput,
  NoteContext,
} from './services/chats/chat.repository';

export { FileRepository } from './services/files/file.repository';
export type {
  FileRecord,
  UpsertFileInput,
} from './services/files/file.repository';
