export type { NoteAnalysis } from '../schemas/notes.schema'

export type {
  AllContentType,
  ContentTag,
  TaskPriority,
  TaskStatus,
} from '../schemas/notes.schema'

export {
  NoteContentTypeSchema,
  NoteStatusSchema,
  TaskPrioritySchema,
  TaskStatusSchema,
} from '../schemas/notes.schema'

import type { InferResponseType } from 'hono/client'
import type { HonoClient } from '../core/api-client'

export type PublishingMetadata = {
  platform?: string | undefined
  url?: string | undefined
  externalId?: string | undefined
  seo?: {
    metaTitle?: string | undefined
    metaDescription?: string | undefined
    keywords?: string[] | undefined
    canonicalUrl?: string | undefined
    featuredImage?: string | undefined
  } | undefined
  metrics?: {
    views?: number | undefined
    likes?: number | undefined
    reposts?: number | undefined
    replies?: number | undefined
    clicks?: number | undefined
  } | undefined
  threadPosition?: number | undefined
  threadId?: string | undefined
  inReplyTo?: string | undefined
  scheduledFor?: string | undefined
  importedAt?: string | undefined
  importedFrom?: string | undefined
}

// Derived from the upstream API — types flow from db → api → apps
type _NoteEndpoint = HonoClient['api']['notes'][':id']['$get']
export type Note = InferResponseType<_NoteEndpoint, 200>
export type NoteFile = Note['files'][number]

type _NoteSearchEndpoint = HonoClient['api']['notes']['search']['$get']
type _NoteSearchResponse = InferResponseType<_NoteSearchEndpoint, 200>
export type NoteSearchResult = _NoteSearchResponse['notes'][number]

type _NoteFeedEndpoint = HonoClient['api']['notes']['feed']['$get']
export type NoteFeedPage = InferResponseType<_NoteFeedEndpoint, 200>
export type NoteFeedItem = NoteFeedPage['notes'][number]

export type NoteContentType =
  | 'note'
  | 'document'
  | 'task'
  | 'timer'
  | 'journal'
  | 'tweet'
  | 'essay'
  | 'blog_post'
  | 'social_post'

export type NoteStatus = 'draft' | 'published' | 'archived'

export type NoteMention = {
  id: string
  name: string
}

export type NotesListOutput = { notes: Note[] };
export type NotesFeedOutput = NoteFeedPage;
export type NotesGetOutput = Note;
export type NotesCreateOutput = Note;
export type NotesUpdateOutput = Note;
export type NotesDeleteOutput = Note;
export type NotesSearchOutput = { notes: NoteSearchResult[]; nextCursor: string | null };

export type NotesListInput = {
  query?: string;
  since?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export type NotesFeedInput = {
  limit?: number;
  cursor?: string;
};

export type NotesSearchInput = {
  query: string;
  limit?: number;
  cursor?: string;
};

// ============================================================================
// CREATE NOTE
// ============================================================================

export type NotesCreateInput = {
  type?: NoteContentType;
  title?: string;
  content: string;
  fileIds?: string[];
};

// ============================================================================
// UPDATE NOTE
// ============================================================================

export type NotesUpdateInput = {
  title?: string | null;
  content?: string;
  fileIds?: string[];
};
