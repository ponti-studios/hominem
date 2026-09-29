import { randomUUID } from 'node:crypto';

import { generateEmbedding } from '@hominem/ai';
import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import type { NoteKind, NoteRecord } from '@hominem/db/notes';
import { NoteRepository } from '@hominem/db/notes';
import { runInTransaction } from '@hominem/db/transaction';
import { VectorDocumentRepository } from '@hominem/db/vector';
import { embeddingQueue } from '@hominem/queues';

import {
  assertUnderMonthlyUsageLimit,
  recordAIUsageEvent,
  startAIUsageTimer,
} from './ai-usage.service';

interface CreateNoteParams {
  kind?: NoteKind;
  title?: string | null | undefined;
  content: string;
  fileIds?: string[];
}

interface UpdateNoteParams {
  title?: string | null | undefined;
  content?: string;
  fileIds?: string[];
}

export interface SemanticSearchNoteResult {
  id: string;
  title: string | null;
  excerpt: string | null;
  similarity: number;
}

// Notes with kind = 'memory' are embedded alongside notes but stay owned by the memory tools.
const NOTE_KIND: NoteKind = 'note';
const EMBEDDING_DIMENSIONS = 1536;
// Upper bound on how many vector matches semanticSearch fetches in one query, since memories
// are embedded alongside notes and may crowd out note-kind matches in the nearest neighbors.
const MAX_SEMANTIC_SEARCH_FETCH = 200;

export class NoteService {
  /** A note owned by the user, or null if it doesn't exist, isn't theirs, or isn't kind 'note'. */
  async getOwnedNote(userId: string, noteId: string): Promise<NoteRecord | null> {
    try {
      const note = await NoteRepository.load(db, noteId, userId);
      return note.kind === NOTE_KIND ? note : null;
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
  }

  async listNotes(userId: string, input: { query?: string; limit: number }): Promise<NoteRecord[]> {
    return NoteRepository.list(db, {
      userId,
      kind: NOTE_KIND,
      ...(input.query ? { query: input.query } : {}),
      limit: input.limit,
    });
  }

  /** Deletes a note (and its vector index entry) and returns it, or null if not found/not owned. */
  async deleteNote(userId: string, noteId: string): Promise<NoteRecord | null> {
    const note = await this.getOwnedNote(userId, noteId);
    if (!note) return null;
    try {
      await NoteRepository.hardDelete(db, { noteId, userId });
    } catch (error) {
      // Deleted between the check above and here — treat as already gone.
      if (error instanceof NotFoundError) return null;
      throw error;
    }
    await VectorDocumentRepository.deleteForEntity(db, 'note', noteId);
    return note;
  }

  private async enqueueEmbedding(userId: string, noteId: string): Promise<void> {
    // A fresh id per revision: reusing `note-${noteId}` let a still-active or
    // failed (removeOnFail: false) job block every later update to the same note.
    const jobId = randomUUID();
    await embeddingQueue.add(
      'generate-embedding',
      { jobId, userId, entityType: 'note' as const, entityId: noteId },
      { jobId, removeOnComplete: true, removeOnFail: false },
    );
  }

  async semanticSearch(
    userId: string,
    input: { query: string; limit: number },
  ): Promise<SemanticSearchNoteResult[]> {
    await assertUnderMonthlyUsageLimit(userId);

    const eventId = randomUUID();
    const getDurationMs = startAIUsageTimer();
    let embedded: Awaited<ReturnType<typeof generateEmbedding>>;
    try {
      embedded = await generateEmbedding(input.query, {
        dimensions: EMBEDDING_DIMENSIONS,
        inputType: 'search_query',
      });
    } catch (error) {
      await recordAIUsageEvent({
        eventId,
        userId,
        feature: 'embedding',
        operation: 'embedding',
        status: 'failed',
        error,
        durationMs: getDurationMs(),
        metadata: { purpose: 'semantic_search' },
      });
      throw error;
    }
    await recordAIUsageEvent({
      eventId,
      userId,
      feature: 'embedding',
      operation: 'embedding',
      usage: embedded.usage,
      status: 'succeeded',
      durationMs: getDurationMs(),
      metadata: { purpose: 'semantic_search' },
    });
    if (embedded.embedding.length === 0) return [];

    // Memories are embedded as notes too, so the nearest vectors may all be memories. Fetch up
    // to the cap in a single round trip rather than retrying with a growing limit — the vector
    // index handles a larger limit cheaply, and re-querying on every retry cost far more than
    // just fetching the cap up front.
    const matches = await VectorDocumentRepository.search(db, {
      userId,
      embedding: embedded.embedding,
      entityType: 'note',
      limit: MAX_SEMANTIC_SEARCH_FETCH,
    });

    const summaries = await NoteRepository.getOwnedSummariesByIds(db, {
      userId,
      kind: NOTE_KIND,
      noteIds: matches.map((match) => match.entityId),
    });
    const summariesById = new Map(summaries.map((summary) => [summary.id, summary]));
    return matches
      .flatMap((match) => {
        const row = summariesById.get(match.entityId);
        return row ? [{ ...row, similarity: match.similarity }] : [];
      })
      .slice(0, input.limit);
  }

  /** Creates a note and queues it for semantic-search indexing. */
  async createNote(userId: string, input: CreateNoteParams): Promise<NoteRecord> {
    // Need the explicit return type here — without it TS infers runInTransaction's T from
    // this whole callback before checking it, which is one of the slowest typecheck spans
    // in services/api (~765ms). Annotating it short-circuits that.
    const note = await runInTransaction(async (trx): Promise<NoteRecord> => {
      const content = input.content.trim();
      // never auto-derive the title from content — only use it if it was actually passed in
      const title = input.title?.trim() || null;
      const excerpt = deriveExcerpt(content);

      const created = await NoteRepository.create(trx, {
        userId,
        kind: input.kind,
        title,
        content,
        excerpt,
      });

      await NoteRepository.syncFiles(trx, {
        noteId: created.id,
        userId,
        fileIds: input.fileIds ?? [],
      });
      return NoteRepository.load(trx, created.id, userId);
    });
    await this.enqueueEmbedding(userId, note.id);
    return note;
  }

  /**
   * Updates any note or memory row owned by the user and re-queues it for indexing, or returns
   * null if it doesn't exist or isn't theirs — never throws for a missing note. Not kind-scoped:
   * the memory routes reuse this directly, so use updateOwnedNote to restrict to kind 'note'.
   */
  async updateNote(
    noteId: string,
    userId: string,
    input: UpdateNoteParams,
  ): Promise<NoteRecord | null> {
    let note: NoteRecord;
    try {
      note = await runInTransaction(async (trx): Promise<NoteRecord> => {
        const existing = await NoteRepository.getOwnedOrThrow(trx, noteId, userId);
        const nextContent = input.content !== undefined ? input.content.trim() : existing.content;
        // only touch the title if it was explicitly sent
        const nextTitle = input.title !== undefined ? input.title?.trim() || null : existing.title;
        // but the excerpt always gets recomputed, since it just follows the content
        const nextExcerpt = deriveExcerpt(nextContent);

        await NoteRepository.update(trx, {
          noteId,
          userId,
          input: {
            title: nextTitle,
            content: nextContent,
            excerpt: nextExcerpt,
          },
        });

        if (input.fileIds) {
          await NoteRepository.syncFiles(trx, { noteId, userId, fileIds: input.fileIds });
        }

        return NoteRepository.load(trx, noteId, userId);
      });
    } catch (error) {
      if (error instanceof NotFoundError) return null;
      throw error;
    }
    await this.enqueueEmbedding(userId, note.id);
    return note;
  }

  /** Updates a note owned by the user, or null if it doesn't exist, isn't theirs, or isn't kind 'note'. */
  async updateOwnedNote(
    userId: string,
    noteId: string,
    input: UpdateNoteParams,
  ): Promise<NoteRecord | null> {
    const row = await NoteRepository.getOwned(db, noteId, userId);
    if (!row || row.kind !== NOTE_KIND) return null;
    return this.updateNote(noteId, userId, input);
  }

  async searchNotes(
    userId: string,
    input: { query: string; limit?: number; cursor?: string },
  ): Promise<{
    notes: Array<{ id: string; title: string | null; excerpt: string | null }>;
    nextCursor: string | null;
  }> {
    return NoteRepository.search(db, {
      userId,
      query: input.query,
      kind: NOTE_KIND,
      limit: input.limit ?? 10,
      ...(input.cursor ? { cursor: input.cursor } : {}),
    });
  }
}

function deriveExcerpt(content: string): string | null {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized.slice(0, 240) : null;
}
