import type { RawHonoClient } from '../core/raw-client';
import { NoteSchema } from '../schemas/notes.schema';
import type {
  Note,
  NotesArchiveOutput,
  NotesCreateInput,
  NotesCreateOutput,
  NotesDeleteOutput,
  NotesFeedInput,
  NotesFeedOutput,
  NotesGetOutput,
  NotesListInput,
  NotesListOutput,
  NotesSearchOutput,
  NotesUpdateInput,
  NotesUpdateOutput,
} from '../types/notes.types';

function parseNoteResponse(value: unknown): Note {
  const parsed = NoteSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid note response');
  }
  return parsed.data;
}

export interface NotesGetInput {
  id: string;
}

export interface NotesUpdateByIdInput extends NotesUpdateInput {
  id: string;
}

export interface NotesDeleteInput {
  id: string;
}

export interface NotesArchiveInput {
  id: string;
}

export interface NotesSearchInput {
  query: string;
  limit?: number;
}

function toNotesQuery(input: NotesListInput): Record<string, string> {
  const query: Record<string, string> = {};

  if (input.types) {
    query.types = input.types.join(',');
  }
  if (input.status) {
    query.status = input.status.join(',');
  }
  if (input.tags) {
    query.tags = input.tags.join(',');
  }
  if (input.query) {
    query.query = input.query;
  }
  if (input.since) {
    query.since = input.since;
  }
  if (input.sortBy) {
    query.sortBy = input.sortBy;
  }
  if (input.sortOrder) {
    query.sortOrder = input.sortOrder;
  }
  if (typeof input.limit === 'number') {
    query.limit = String(input.limit);
  }
  if (typeof input.offset === 'number') {
    query.offset = String(input.offset);
  }
  if (typeof input.includeAllVersions === 'boolean') {
    query.includeAllVersions = String(input.includeAllVersions);
  }

  return query;
}

// ─── NotesClient interface ────────────────────────────────────────────────────

export interface NotesClient {
  list(input: NotesListInput): Promise<NotesListOutput>;
  feed(input: NotesFeedInput): Promise<NotesFeedOutput>;
  search(input: NotesSearchInput): Promise<NotesSearchOutput>;
  get(input: NotesGetInput): Promise<NotesGetOutput>;
  create(input: NotesCreateInput): Promise<NotesCreateOutput>;
  update(input: NotesUpdateByIdInput): Promise<NotesUpdateOutput>;
  delete(input: NotesDeleteInput): Promise<NotesDeleteOutput>;
  archive(input: NotesArchiveInput): Promise<NotesArchiveOutput>;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createNotesClient(rawClient: RawHonoClient): NotesClient {
  return {
    async list(input) {
      const res = await rawClient.get('/api/notes', { query: toNotesQuery(input) });
      return res.json() as Promise<NotesListOutput>;
    },

    async feed(input) {
      const query: Record<string, string> = {};

      if (typeof input.limit === 'number') {
        query.limit = String(input.limit);
      }
      if (input.cursor) {
        query.cursor = input.cursor;
      }

      const res = await rawClient.get('/api/notes/feed', { query });
      return res.json() as Promise<NotesFeedOutput>;
    },

    async search(input) {
      const query: Record<string, string> = { query: input.query };
      if (typeof input.limit === 'number') {
        query.limit = String(input.limit);
      }
      const res = await rawClient.get('/api/notes/search', { query });
      return res.json() as Promise<NotesSearchOutput>;
    },

    async get(input) {
      const res = await rawClient.get(`/api/notes/${input.id}`);
      return parseNoteResponse(await res.json()) as NotesGetOutput;
    },

    async create(input) {
      const res = await rawClient.post('/api/notes', { json: input });
      return parseNoteResponse(await res.json()) as NotesCreateOutput;
    },

    async update(input) {
      const { id, ...data } = input;
      const res = await rawClient.patch(`/api/notes/${id}`, { json: data });
      return parseNoteResponse(await res.json()) as NotesUpdateOutput;
    },

    async delete(input) {
      const res = await rawClient.delete(`/api/notes/${input.id}`);
      return parseNoteResponse(await res.json()) as NotesDeleteOutput;
    },

    async archive(input) {
      const res = await rawClient.post(`/api/notes/${input.id}/archive`);
      return parseNoteResponse(await res.json()) as NotesArchiveOutput;
    },
  };
}
