import { randomUUID } from 'node:crypto';

import { generateEmbedding } from '@hominem/ai';
import { db } from '@hominem/db/core';
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
// Upper bound on how many vector matches semanticSearch will fetch while paging past
// memory-kind matches to fill a page of note-kind results.
const MAX_SEMANTIC_SEARCH_FETCH = 200;

export class NoteService {
  /** A note owned by the user, or null if it doesn't exist, isn't theirs, or isn't kind 'note'. */
  async getOwnedNote(userId: string, noteId: string): Promise<NoteRecord | null> {
    const row = await NoteRepository.getOwned(db, noteId, userId);
    if (!row || row.kind !== NOTE_KIND) return null;
    return NoteRepository.load(db, noteId, userId);
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
    await NoteRepository.hardDelete(db, { noteId, userId });
    await VectorDocumentRepository.deleteForEntity(db, 'note', noteId);
    return note;
  }

  async enqueueEmbedding(userId: string, noteId: string): Promise<void> {
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

    // Memories are embedded as notes too, so the nearest vectors may all be memories.
    // Page with a growing fetch limit until enough note-kind matches are found, no more
    // vectors are available, or the fetch cap is hit.
    let results: SemanticSearchNoteResult[] = [];
    let fetchLimit = Math.min(input.limit * 3, MAX_SEMANTIC_SEARCH_FETCH);
    for (;;) {
      const matches = await VectorDocumentRepository.search(db, {
        userId,
        embedding: embedded.embedding,
        entityType: 'note',
        limit: fetchLimit,
      });

      results = [];
      for (const match of matches) {
        if (results.length >= input.limit) break;
        const row = await NoteRepository.getOwned(db, match.entityId, userId);
        if (!row || row.kind !== NOTE_KIND) continue;
        results.push({
          id: row.id,
          title: row.title,
          excerpt: row.excerpt,
          similarity: match.similarity,
        });
      }

      const exhausted = matches.length < fetchLimit || fetchLimit >= MAX_SEMANTIC_SEARCH_FETCH;
      if (results.length >= input.limit || exhausted) break;
      fetchLimit = Math.min(fetchLimit * 2, MAX_SEMANTIC_SEARCH_FETCH);
    }
    return results;
  }

  async createNote(userId: string, input: CreateNoteParams): Promise<NoteRecord> {
    // Need the explicit return type here — without it TS infers runInTransaction's T from
    // this whole callback before checking it, which is one of the slowest typecheck spans
    // in services/api (~765ms). Annotating it short-circuits that.
    return runInTransaction(async (trx): Promise<NoteRecord> => {
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
  }

  async updateNote(noteId: string, userId: string, input: UpdateNoteParams): Promise<NoteRecord> {
    return runInTransaction(async (trx): Promise<NoteRecord> => {
      const existing = await NoteRepository.getOwnedOrThrow(trx, noteId, userId);
      const nextContent = input.content !== undefined ? input.content.trim() : existing.content;
      // same deal — only touch the title if it was explicitly sent
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
  }
}

function deriveExcerpt(content: string): string | null {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length > 0 ? normalized.slice(0, 240) : null;
}
