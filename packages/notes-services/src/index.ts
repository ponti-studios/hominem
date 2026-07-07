// Notes service stubs — implementations pending

import type { ToolSet } from './tools';

export type Note = Record<string, unknown>;
export type PublishingMetadata = Record<string, unknown>;
export type ContentTag = { id: string; name: string };
export type NoteMention = { id: string; userId: string };
export type NoteAnalysis = Record<string, unknown>;

export const NotesService = {
  getNote: async (_id: string, _userId: string): Promise<Note | null> => {
    throw new Error('Not implemented');
  },
  createNote: async (_input: Record<string, unknown>): Promise<Note> => {
    throw new Error('Not implemented');
  },
  updateNote: async (_id: string, _input: Record<string, unknown>): Promise<Note> => {
    throw new Error('Not implemented');
  },
  deleteNote: async (_id: string, _userId: string): Promise<boolean> => {
    throw new Error('Not implemented');
  },
};

// Tool functions for AI integration
export const createNoteTool = (_userId: string): ToolSet[keyof ToolSet] => {
  throw new Error('Not implemented');
};

export const listNotesTool = (_userId: string): ToolSet[keyof ToolSet] => {
  throw new Error('Not implemented');
};
