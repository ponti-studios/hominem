/**
 * @hominem/db - Database access layer for `hominem` services
 *
 * NOT for use in client applications - use @hominem/rpc instead.
 */

export type { Selectable } from 'kysely';
export { db, healthCheck, pool, sql } from './db';
export type { DB as Database, Json, JsonArray, JsonObject, JsonValue } from './types/database';

// Transaction support
export { getDb, runInTransaction } from './transaction';
export type { DbHandle, TransactionHandle } from './transaction';

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
  AppMusicPlaylists,
  AppMusicPlaylistTracks,
  AppMusicTracks,
  AppNoteFiles,
  AppNotes,
  AppNoteShares,
  AppNoteVersions,
  AppPeople,
  AppPlaces,
  AppPlaidItems,
  AppPossessionContainers,
  AppPossessionEvents,
  AppPossessions,
  AppSpaceInvites,
  AppSpaceItems,
  AppSpaceMembers,
  AppSpaces,
  AppSpaceTags,
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
