import type { InferRequestType, InferResponseType } from 'hono/client'
import type { HonoClient } from '../core/api-client'

// ============================================================================
// GET
// ============================================================================

type _NoteEndpoint = HonoClient['api']['notes'][':id']['$get']
export type Note = InferResponseType<_NoteEndpoint, 200>
export type NoteFile = Note['files'][number]
export type NoteContentType = Note['type']
export type NoteStatus = Note['status']
export type NoteMention = NonNullable<Note['mentions']>[number]
export type PublishingMetadata = NonNullable<Note['publishingMetadata']>

// ============================================================================
// LIST
// ============================================================================

type _NotesListEndpoint = HonoClient['api']['notes']['$get']
export type NotesListOutput = InferResponseType<_NotesListEndpoint, 200>
export type NotesListInput = InferRequestType<_NotesListEndpoint>['query']

// ============================================================================
// FEED
// ============================================================================

type _NoteFeedEndpoint = HonoClient['api']['notes']['feed']['$get']
export type NoteFeedPage = InferResponseType<_NoteFeedEndpoint, 200>
export type NoteFeedItem = NoteFeedPage['notes'][number]
export type NotesFeedInput = InferRequestType<_NoteFeedEndpoint>['query']

// ============================================================================
// SEARCH
// ============================================================================

type _NoteSearchEndpoint = HonoClient['api']['notes']['search']['$get']
export type NotesSearchOutput = InferResponseType<_NoteSearchEndpoint, 200>
export type NoteSearchResult = NotesSearchOutput['notes'][number]
export type NotesSearchInput = InferRequestType<_NoteSearchEndpoint>['query']

// ============================================================================
// CREATE
// ============================================================================

type _NotesCreateEndpoint = HonoClient['api']['notes']['$post']
export type NotesCreateInput = InferRequestType<_NotesCreateEndpoint>['json']
export type NotesCreateOutput = InferResponseType<_NotesCreateEndpoint, 201>

// ============================================================================
// UPDATE
// ============================================================================

type _NotesUpdateEndpoint = HonoClient['api']['notes'][':id']['$patch']
export type NotesUpdateInput = InferRequestType<_NotesUpdateEndpoint>['json']
export type NotesUpdateOutput = InferResponseType<_NotesUpdateEndpoint, 200>

// ============================================================================
// DELETE
// ============================================================================

type _NotesDeleteEndpoint = HonoClient['api']['notes'][':id']['$delete']
export type NotesDeleteOutput = InferResponseType<_NotesDeleteEndpoint, 200>
