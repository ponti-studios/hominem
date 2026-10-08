import { db } from '@hominem/db/core';
import { NoteRepository } from '@hominem/db/notes';
import { VectorDocumentRepository } from '@hominem/db/vector';

import { rememberMemory } from '../../application/memory.service';
import {
  forgetMemoryInputSchema,
  forgetMemoryOutputSchema,
  listMemoriesInputSchema,
  listMemoriesOutputSchema,
  rememberInputSchema,
  rememberOutputSchema,
  searchMemoriesInputSchema,
  searchMemoriesOutputSchema,
} from '../../schemas/memory.schema';
import { registerTool } from '../tool-registry';

// Memories are just notes with kind = 'memory', so they show up anywhere notes already do.
const MEMORY_KIND = 'memory' as const;

function toMemorySummary(note: {
  id: string;
  title: string | null;
  excerpt: string | null;
  createdAt: string;
}) {
  return { id: note.id, title: note.title, excerpt: note.excerpt, createdAt: note.createdAt };
}

registerTool(
  {
    standaloneWrite: true,
    name: 'remember',
    title: 'Remember something about the user',
    description:
      'Saves a durable fact, preference, or piece of personal context as a memory. Call this ' +
      'immediately when the user asks to be remembered something, or when a lasting fact about ' +
      'them surfaces naturally in conversation — no confirmation needed before saving. ' +
      'Each call saves exactly one distinct fact: if the user mentions several facts, make one ' +
      'call per fact. Never save the same fact more than once or under multiple titles — an ' +
      'identical fact already in memory is returned as-is instead of being saved again.',
    inputSchema: rememberInputSchema,
    outputSchema: rememberOutputSchema,
    readOnly: false,
    scopes: ['memory:write'],
    resultCap: 1,
    destructive: false,
    // An identical fact already saved is returned as-is rather than duplicated
    // (see rememberMemory), so repeat calls converge.
    idempotent: true,
    guidance: {
      whenToUse: 'The user explicitly asks to remember something or states a durable preference.',
      whenNotToUse:
        'Do not save transient instructions, one-off plans, or facts about other people. Things the user needs to do, deadlines, appointments and reminders are tasks: use task_create.',
      produces: ['memory id', 'saved memory content'],
    },
  },
  async (ownerUserId, input) => {
    const result = await rememberMemory(ownerUserId, input);
    return toMemorySummary(result.record);
  },
);

registerTool(
  {
    name: 'list_memories',
    title: 'List remembered facts',
    description: 'Lists the most recently saved memories about the user, newest first.',
    inputSchema: listMemoriesInputSchema,
    outputSchema: listMemoriesOutputSchema,
    readOnly: true,
    scopes: ['memory:read'],
    resultCap: 50,
    guidance: {
      whenToUse: 'A broad recent-memory review is requested or keyword search is not useful.',
      whenNotToUse: 'Do not use as a substitute for current domain data such as trips or finances.',
      produces: ['memory ids', 'memory content'],
    },
  },
  async (ownerUserId, input) => {
    const notes = await NoteRepository.list(db, {
      userId: ownerUserId,
      kind: MEMORY_KIND,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: input.limit ?? 20,
    });
    return { memories: notes.map(toMemorySummary) };
  },
);

registerTool(
  {
    name: 'search_memories',
    title: 'Search remembered facts',
    description:
      'Searches saved memories by keyword. Call this before answering questions that plausibly ' +
      'depend on remembered personal context, rather than assuming none exists. If no keyword ' +
      'match is found, returns the full recent memory list instead so nothing is missed.',
    inputSchema: searchMemoriesInputSchema,
    outputSchema: searchMemoriesOutputSchema,
    readOnly: true,
    scopes: ['memory:read'],
    resultCap: 50,
    guidance: {
      whenToUse:
        'A response depends on remembered personal context and a keyword search is appropriate.',
      whenNotToUse: 'Do not use as a substitute for current domain data such as trips or finances.',
      produces: ['memory ids', 'memory content'],
    },
  },
  async (ownerUserId, input) => {
    const limit = input.limit ?? 20;
    const notes = await NoteRepository.list(db, {
      userId: ownerUserId,
      kind: MEMORY_KIND,
      query: input.query,
      limit,
    });
    // Search is just a substring match, so "food allergies" won't find a memory
    // saved as "allergic to peanuts". If nothing matches, fall back to the full
    // recent list so the model can reason over the actual content instead of
    // just saying "nothing found" — cheap enough at this scale.
    if (notes.length === 0) {
      const allNotes = await NoteRepository.list(db, {
        userId: ownerUserId,
        kind: MEMORY_KIND,
        limit,
      });
      return { memories: allNotes.map(toMemorySummary) };
    }
    return { memories: notes.map(toMemorySummary) };
  },
);

registerTool(
  {
    name: 'forget_memory',
    title: 'Forget a remembered fact',
    description: 'Permanently deletes a saved memory.',
    inputSchema: forgetMemoryInputSchema,
    outputSchema: forgetMemoryOutputSchema,
    readOnly: false,
    scopes: ['memory:write'],
    resultCap: 1,
    destructive: true,
    idempotent: true,
    requiresConfirmation: true,
    preview: async (ownerUserId, input) => {
      const parsed = forgetMemoryInputSchema.safeParse(input);
      if (!parsed.success) return null;
      const note = await NoteRepository.getOwned(db, parsed.data.id, ownerUserId);
      if (!note || note.kind !== MEMORY_KIND) return null;
      return {
        title: note.title ?? '(untitled)',
        excerpt: note.excerpt ?? note.content.slice(0, 200),
      };
    },
  },
  async (ownerUserId, input) => {
    const note = await NoteRepository.getOwned(db, input.id, ownerUserId);
    if (!note || note.kind !== MEMORY_KIND) {
      return { removed: false };
    }
    await NoteRepository.hardDelete(db, { noteId: input.id, userId: ownerUserId });
    await VectorDocumentRepository.deleteForEntity(db, 'note', input.id);
    return { removed: true };
  },
);
