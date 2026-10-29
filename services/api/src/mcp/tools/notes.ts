import type { NoteRecord } from '@hominem/db/notes';

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
    const notes = await noteService.listNotes(ownerUserId, {
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
    const note = await noteService.getOwnedNote(ownerUserId, input.id);
    return { note: note ? toNoteDetail(note) : null };
  },
);

registerTool(
  {
    ...writeTool,
    standaloneWrite: true,
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
    const note = await noteService.updateOwnedNote(ownerUserId, input.id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
    });
    return { note: note ? toNoteDetail(note) : null };
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
      const note = await noteService.getOwnedNote(ownerUserId, parsed.data.id);
      return note ? { title: note.title ?? '(untitled)', excerpt: note.excerpt } : null;
    },
  },
  async (ownerUserId, input) => {
    const note = await noteService.deleteNote(ownerUserId, input.id);
    return { removed: note !== null };
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
    const results = await noteService.semanticSearch(ownerUserId, input);
    return { results };
  },
);
