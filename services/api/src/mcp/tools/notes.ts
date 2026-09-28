import { randomUUID } from 'node:crypto';

import { generateEmbedding } from '@hominem/ai';
import { db } from '@hominem/db/core';
import { NotFoundError } from '@hominem/db/errors';
import { NoteRepository, type NoteRecord } from '@hominem/db/notes';
import { VectorDocumentRepository } from '@hominem/db/vector';
import { embeddingQueue } from '@hominem/queues';

import {
  assertUnderMonthlyUsageLimit,
  recordAIUsageEvent,
  startAIUsageTimer,
} from '../../application/ai-usage.service';
import { NoteService } from '../../application/notes.service';
import {
  NoteParamSchema,
  noteCreateToolInputSchema,
  noteCreateToolOutputSchema,
  noteDeleteToolOutputSchema,
  noteGetToolOutputSchema,
  noteListToolInputSchema,
  noteListToolOutputSchema,
  noteUpdateToolInputSchema,
  noteUpdateToolOutputSchema,
  semanticSearchInputSchema,
  semanticSearchOutputSchema,
} from '../../schemas/notes.schema';
import { registerTool } from '../tool-registry';

const noteService = new NoteService();

// Memories are notes with kind = 'memory' and stay owned by the memory tools.
const NOTE_KIND = 'note' as const;
const EMBEDDING_DIMENSIONS = 1536;

async function enqueueNoteEmbedding(userId: string, noteId: string) {
  await embeddingQueue.add(
    'generate-embedding',
    { jobId: `note-${noteId}`, userId, entityType: 'note' as const, entityId: noteId },
    { jobId: `note-${noteId}`, removeOnComplete: true, removeOnFail: false },
  );
}

function toNoteSummary(note: NoteRecord) {
  return {
    id: note.id,
    title: note.title,
    excerpt: note.excerpt,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function toNoteDetail(note: NoteRecord) {
  return { ...toNoteSummary(note), content: note.content };
}

async function loadNote(ownerUserId: string, id: string): Promise<NoteRecord | null> {
  const row = await NoteRepository.getOwned(db, id, ownerUserId);
  if (!row || row.kind !== NOTE_KIND) return null;
  return NoteRepository.load(db, id, ownerUserId);
}

const writeTool: {
  readOnly: false;
  scopes: ['notes:write'];
  resultCap: number;
  destructive: false;
  idempotent: false;
} = {
  readOnly: false,
  scopes: ['notes:write'],
  resultCap: 1,
  destructive: false,
  idempotent: false,
};

registerTool(
  {
    name: 'note_list',
    title: 'List notes',
    description:
      "Lists the user's notes, most recently updated first, optionally filtered by a keyword " +
      'matched against titles and content. Returns summaries; use note_get for the full body.',
    inputSchema: noteListToolInputSchema,
    outputSchema: noteListToolOutputSchema,
    readOnly: true,
    scopes: ['notes:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'The user asks about their notes or wants to find one by keyword.',
      whenNotToUse: 'Do not use for remembered personal facts; use search_memories instead.',
      produces: ['note ids', 'note titles', 'note excerpts'],
    },
  },
  async (ownerUserId, input) => {
    const notes = await NoteRepository.list(db, {
      userId: ownerUserId,
      kind: NOTE_KIND,
      ...(input.query ? { query: input.query } : {}),
      limit: input.limit,
    });
    return { notes: notes.map(toNoteSummary) };
  },
);

registerTool(
  {
    name: 'note_get',
    title: 'Get a note',
    description: 'Returns the full content of a note by id, or null if it does not exist.',
    inputSchema: NoteParamSchema,
    outputSchema: noteGetToolOutputSchema,
    readOnly: true,
    scopes: ['notes:read'],
    resultCap: 1,
    guidance: {
      whenToUse: 'A note id has been returned by note_list, semantic_search or note_create.',
      whenNotToUse: 'Do not invent a note id.',
      dependencies: [{ tool: 'note_list', reason: 'resolve the stable note id', provides: ['id'] }],
    },
  },
  async (ownerUserId, input) => {
    const note = await loadNote(ownerUserId, input.id);
    return { note: note ? toNoteDetail(note) : null };
  },
);

registerTool(
  {
    ...writeTool,
    name: 'note_create',
    title: 'Create a note',
    description: 'Saves a new note with an optional title.',
    inputSchema: noteCreateToolInputSchema,
    outputSchema: noteCreateToolOutputSchema,
    guidance: {
      whenToUse: 'The user asks to write down, save or capture something as a note.',
      whenNotToUse: 'Do not use for durable personal facts; use remember instead.',
      produces: ['note id'],
    },
  },
  async (ownerUserId, input) => {
    const note = await noteService.createNote(ownerUserId, {
      title: input.title ?? null,
      content: input.content,
    });
    await enqueueNoteEmbedding(ownerUserId, note.id);
    return { note: toNoteDetail(note) };
  },
);

registerTool(
  {
    ...writeTool,
    idempotent: true,
    name: 'note_update',
    title: 'Update a note',
    description: "Replaces a note's title and/or content. Returns null if the note does not exist.",
    inputSchema: noteUpdateToolInputSchema,
    outputSchema: noteUpdateToolOutputSchema,
    guidance: {
      whenToUse: 'A note id has been returned by note_list or note_get.',
      whenNotToUse: 'Do not invent a note id.',
      dependencies: [{ tool: 'note_list', reason: 'resolve the stable note id', provides: ['id'] }],
    },
  },
  async (ownerUserId, input) => {
    if (!(await loadNote(ownerUserId, input.id))) return { note: null };
    try {
      const note = await noteService.updateNote(input.id, ownerUserId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
      });
      await enqueueNoteEmbedding(ownerUserId, note.id);
      return { note: toNoteDetail(note) };
    } catch (error) {
      if (error instanceof NotFoundError) return { note: null };
      throw error;
    }
  },
);

registerTool(
  {
    ...writeTool,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    name: 'note_delete',
    title: 'Delete a note',
    description: 'Permanently deletes a note.',
    inputSchema: NoteParamSchema,
    outputSchema: noteDeleteToolOutputSchema,
    guidance: {
      whenToUse:
        'A note id has been returned by note_list or note_get and the user asked to delete it.',
      whenNotToUse: 'Do not invent a note id or delete before lookup and confirmation.',
      dependencies: [{ tool: 'note_list', reason: 'resolve the stable note id', provides: ['id'] }],
    },
    preview: async (ownerUserId, input) => {
      const parsed = NoteParamSchema.safeParse(input);
      if (!parsed.success) return null;
      const note = await loadNote(ownerUserId, parsed.data.id);
      return note ? { title: note.title ?? '(untitled)', excerpt: note.excerpt } : null;
    },
  },
  async (ownerUserId, input) => {
    if (!(await loadNote(ownerUserId, input.id))) return { removed: false };
    try {
      await NoteRepository.hardDelete(db, { noteId: input.id, userId: ownerUserId });
    } catch (error) {
      if (error instanceof NotFoundError) return { removed: false };
      throw error;
    }
    await VectorDocumentRepository.deleteForEntity(db, 'note', input.id);
    return { removed: true };
  },
);

registerTool(
  {
    name: 'semantic_search',
    title: 'Search notes by meaning',
    description:
      'Finds notes whose meaning is closest to a natural-language query, even when they share no ' +
      'keywords with it. Only notes that have finished indexing appear; a note created moments ago ' +
      'may not be searchable yet, so fall back to note_list for very recent notes.',
    inputSchema: semanticSearchInputSchema,
    outputSchema: semanticSearchOutputSchema,
    readOnly: true,
    scopes: ['notes:read'],
    resultCap: 20,
    guidance: {
      whenToUse:
        'The user describes what a note was about but keyword search is unlikely to match.',
      whenNotToUse: 'Use note_list when the user gives an exact keyword or title.',
      produces: ['note ids', 'similarity scores'],
    },
  },
  async (ownerUserId, input) => {
    await assertUnderMonthlyUsageLimit(ownerUserId);

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
        userId: ownerUserId,
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
      userId: ownerUserId,
      feature: 'embedding',
      operation: 'embedding',
      usage: embedded.usage,
      status: 'succeeded',
      durationMs: getDurationMs(),
      metadata: { purpose: 'semantic_search' },
    });
    if (embedded.embedding.length === 0) return { results: [] };

    // Memories are embedded as notes too; over-fetch so filtering them out still fills the page.
    const matches = await VectorDocumentRepository.search(db, {
      userId: ownerUserId,
      embedding: embedded.embedding,
      entityType: 'note',
      limit: Math.min(input.limit * 3, 50),
    });

    const results: Array<{
      id: string;
      title: string | null;
      excerpt: string | null;
      similarity: number;
    }> = [];
    for (const match of matches) {
      if (results.length >= input.limit) break;
      const row = await NoteRepository.getOwned(db, match.entityId, ownerUserId);
      if (!row || row.kind !== NOTE_KIND) continue;
      results.push({
        id: row.id,
        title: row.title,
        excerpt: row.excerpt,
        similarity: match.similarity,
      });
    }
    return { results };
  },
);
