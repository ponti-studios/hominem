import type { NoteFeedPageRecord, NoteRecord } from '@hominem/db';
import { getDb, NoteRepository, runInTransaction } from '@hominem/db';

export interface ListNotesParams {
  limit?: number;
  offset?: number;
  since?: string;
  query?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface ListNoteFeedParams {
  limit?: number;
  cursor?: string;
}

export interface CreateNoteParams {
  title?: string | null | undefined;
  content: string;
  excerpt?: string | null | undefined;
  fileIds?: string[];
}

export interface UpdateNoteParams {
  title?: string | null | undefined;
  content?: string;
  excerpt?: string | null | undefined;
  fileIds?: string[];
}

export class NoteService {
  async listNotes(userId: string, params: ListNotesParams): Promise<NoteRecord[]> {
    return NoteRepository.list(getDb(), { userId, ...params });
  }

  async listNoteFeed(userId: string, params: ListNoteFeedParams): Promise<NoteFeedPageRecord> {
    return NoteRepository.listFeed(getDb(), { userId, ...params });
  }

  async searchNotes(
    userId: string,
    query: string,
    limit: number,
  ): Promise<Array<{ id: string; title: string | null; excerpt: string | null }>> {
    return NoteRepository.search(getDb(), { userId, query, limit });
  }

  async getNote(noteId: string, userId: string): Promise<NoteRecord> {
    return NoteRepository.load(getDb(), noteId, userId);
  }

  async createNote(userId: string, input: CreateNoteParams): Promise<NoteRecord> {
    return runInTransaction(async (trx) => {
      const content = input.content.trim();
      const title = deriveTitle(input.title, content);
      const excerpt = deriveExcerpt(input.excerpt, content);

      const created = await NoteRepository.create(trx, {
        userId,
        title,
        content,
        excerpt,
      });

      await NoteRepository.syncFiles(trx, created.id, userId, input.fileIds ?? []);
      return NoteRepository.load(trx, created.id, userId);
    });
  }

  async updateNote(noteId: string, userId: string, input: UpdateNoteParams): Promise<NoteRecord> {
    return runInTransaction(async (trx) => {
      const existing = await NoteRepository.getOwnedOrThrow(trx, noteId, userId);
      const nextContent = input.content !== undefined ? input.content.trim() : existing.content;
      const nextTitle = deriveTitle(input.title, nextContent) ?? existing.title;
      const nextExcerpt =
        input.excerpt !== undefined
          ? deriveExcerpt(input.excerpt, nextContent)
          : deriveExcerpt(existing.excerpt, nextContent);

      await NoteRepository.update(trx, noteId, userId, {
        title: nextTitle,
        content: nextContent,
        excerpt: nextExcerpt,
      });

      if (input.fileIds) {
        await NoteRepository.syncFiles(trx, noteId, userId, input.fileIds);
      }

      return NoteRepository.load(trx, noteId, userId);
    });
  }

  async deleteNote(noteId: string, userId: string): Promise<NoteRecord> {
    const note = await NoteRepository.load(getDb(), noteId, userId);
    await NoteRepository.delete(getDb(), noteId, userId);
    return note;
  }

  async archiveNote(noteId: string, userId: string): Promise<NoteRecord> {
    await NoteRepository.update(getDb(), noteId, userId, {
      archivedAt: new Date().toISOString(),
    });
    return NoteRepository.load(getDb(), noteId, userId);
  }
}

function deriveTitle(title: string | null | undefined, content: string): string | null {
  if (title !== undefined) {
    const trimmedTitle = title?.trim() ?? '';
    return trimmedTitle.length > 0 ? trimmedTitle : null;
  }

  const firstLine = content
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ? firstLine.slice(0, 120) : null;
}

function deriveExcerpt(excerpt: string | null | undefined, content: string): string | null {
  if (excerpt !== undefined) {
    const trimmedExcerpt = excerpt?.trim() ?? '';
    return trimmedExcerpt.length > 0 ? trimmedExcerpt : null;
  }

  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized.slice(0, 240) : null;
}
