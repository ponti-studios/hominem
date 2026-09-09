import type { InferResponseType } from 'hono/client';

import type { HonoClient } from '../core/api-client';

type _NotesGetEndpoint = HonoClient['api']['notes'][':id']['$get'];
export type NotesGetOutput = InferResponseType<_NotesGetEndpoint, 200>;

export type NoteFile = {
  id: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: string;
  content?: string | undefined;
  textContent?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
};

export type Note = {
  id: string;
  userId: string;
  kind: 'note' | 'memory';
  title: string | null;
  content: string;
  excerpt: string | null;
  files: NoteFile[];
  createdAt: string;
  updatedAt: string;
};

export type NoteSearchResult = {
  id: string;
  title: string | null;
  excerpt: string | null;
};

export type NotesSearchOutput = { notes: NoteSearchResult[]; nextCursor: string | null };
